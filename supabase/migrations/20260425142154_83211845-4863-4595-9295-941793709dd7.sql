-- ============================================================
-- 1. Rozšíření tabulky classes
-- ============================================================
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_join_code text,
  ADD COLUMN IF NOT EXISTS teacher_join_code_active boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2. Funkce pro generování TCH-XXXX kódu (bez O/0/I/1)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_teacher_join_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _code text;
  _exists boolean;
  _i int;
BEGIN
  LOOP
    _code := 'TCH-';
    FOR _i IN 1..4 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.classes WHERE teacher_join_code = _code) INTO _exists;
    IF NOT _exists THEN
      RETURN _code;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 3. Tabulka class_teachers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'co_teacher' CHECK (role IN ('owner', 'co_teacher')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON public.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_user_id ON public.class_teachers(user_id);

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Tabulka class_textbooks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_textbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  textbook_id uuid NOT NULL,
  textbook_type text NOT NULL CHECK (textbook_type IN ('global', 'teacher')),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, textbook_id, textbook_type)
);

CREATE INDEX IF NOT EXISTS idx_class_textbooks_class_id ON public.class_textbooks(class_id);

ALTER TABLE public.class_textbooks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Helper funkce
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teachers
    WHERE class_id = _class_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_class_owner(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_teachers
    WHERE class_id = _class_id AND user_id = _user_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.join_class_as_teacher(_code text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _class_id uuid;
  _is_teacher boolean;
BEGIN
  -- Ověř že user má roli teacher nebo admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('teacher', 'admin')
  ) INTO _is_teacher;

  IF NOT _is_teacher THEN
    RETURN NULL;
  END IF;

  -- Najdi třídu podle kódu
  SELECT id INTO _class_id
  FROM public.classes
  WHERE teacher_join_code = _code
    AND teacher_join_code_active = true
    AND archived = false;

  IF _class_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Vlož do class_teachers
  INSERT INTO public.class_teachers (class_id, user_id, role)
  VALUES (_class_id, _user_id, 'co_teacher')
  ON CONFLICT (class_id, user_id) DO NOTHING;

  RETURN _class_id;
END;
$$;

-- ============================================================
-- 6. Trigger: auto-create owner při INSERT do classes
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_class_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.class_teachers (class_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (class_id, user_id) DO NOTHING;
  END IF;

  -- Auto-generuj teacher_join_code pokud chybí
  IF NEW.teacher_join_code IS NULL THEN
    UPDATE public.classes
    SET teacher_join_code = public.generate_teacher_join_code()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_class_owner ON public.classes;
CREATE TRIGGER trg_handle_new_class_owner
  AFTER INSERT ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_class_owner();

-- ============================================================
-- 7. Migrace stávajících dat
-- ============================================================
DO $$
DECLARE
  _admin_id uuid;
  _class record;
BEGIN
  -- Najdi prvního admina
  SELECT user_id INTO _admin_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY user_id
  LIMIT 1;

  -- Pro každou existující třídu
  FOR _class IN SELECT id, created_by, teacher_join_code FROM public.classes LOOP
    -- Doplň created_by pokud chybí
    IF _class.created_by IS NULL AND _admin_id IS NOT NULL THEN
      UPDATE public.classes SET created_by = _admin_id WHERE id = _class.id;
      _class.created_by := _admin_id;
    END IF;

    -- Vytvoř owner záznam pokud ještě neexistuje
    IF _class.created_by IS NOT NULL THEN
      INSERT INTO public.class_teachers (class_id, user_id, role)
      VALUES (_class.id, _class.created_by, 'owner')
      ON CONFLICT (class_id, user_id) DO UPDATE SET role = 'owner';
    END IF;

    -- Vygeneruj teacher_join_code pokud chybí
    IF _class.teacher_join_code IS NULL THEN
      UPDATE public.classes
      SET teacher_join_code = public.generate_teacher_join_code()
      WHERE id = _class.id;
    END IF;
  END LOOP;
END $$;

-- Přidej UNIQUE constraint a NOT NULL až po naplnění dat
ALTER TABLE public.classes
  ADD CONSTRAINT classes_teacher_join_code_unique UNIQUE (teacher_join_code);

-- ============================================================
-- 8. RLS politiky – classes
-- ============================================================
DROP POLICY IF EXISTS "Teacher can insert classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher can update classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher can delete classes" ON public.classes;
DROP POLICY IF EXISTS "Teacher can read classes" ON public.classes;

CREATE POLICY "Teacher can insert classes"
  ON public.classes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "Teacher can read own classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (public.is_class_teacher(id, auth.uid()) OR public.is_admin());

CREATE POLICY "Owner can update classes"
  ON public.classes FOR UPDATE
  TO authenticated
  USING (public.is_class_owner(id, auth.uid()) OR public.is_admin());

CREATE POLICY "Owner can delete classes"
  ON public.classes FOR DELETE
  TO authenticated
  USING (public.is_class_owner(id, auth.uid()) OR public.is_admin());

-- ============================================================
-- 9. RLS politiky – class_teachers
-- ============================================================
CREATE POLICY "Teachers in class can read class_teachers"
  ON public.class_teachers FOR SELECT
  TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Owner can insert class_teachers"
  ON public.class_teachers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_class_owner(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Owner or self can delete class_teachers"
  ON public.class_teachers FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_class_owner(class_id, auth.uid())
    OR (user_id = auth.uid() AND role <> 'owner')
  );

CREATE POLICY "Admin can update class_teachers"
  ON public.class_teachers FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 10. RLS politiky – class_members (úprava)
-- ============================================================
DROP POLICY IF EXISTS "Teacher can insert class_members" ON public.class_members;
DROP POLICY IF EXISTS "Teacher can read class_members" ON public.class_members;
DROP POLICY IF EXISTS "Teacher can delete class_members" ON public.class_members;

CREATE POLICY "Class teachers can read class_members"
  ON public.class_members FOR SELECT
  TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Class teachers can insert class_members"
  ON public.class_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Class teachers can update class_members"
  ON public.class_members FOR UPDATE
  TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Class teachers can delete class_members"
  ON public.class_members FOR DELETE
  TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

-- ============================================================
-- 11. RLS politiky – class_textbooks
-- ============================================================
CREATE POLICY "Class members can read class_textbooks"
  ON public.class_textbooks FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_class_teacher(class_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = class_textbooks.class_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Class teachers can insert class_textbooks"
  ON public.class_textbooks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Class teachers can delete class_textbooks"
  ON public.class_textbooks FOR DELETE
  TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());