-- Tabulka škol
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS schools_set_updated_at ON public.schools;
CREATE TRIGGER schools_set_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Připojení school_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);

-- Pomocné SECURITY DEFINER funkce
CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'school_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin_of(_school_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'school_admin'
      AND p.school_id = _school_id
  )
$$;

-- RLS pro schools
CREATE POLICY "Admin full access to schools"
ON public.schools FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "School admin can read own school"
ON public.schools FOR SELECT
TO authenticated
USING (public.is_school_admin_of(id, auth.uid()));

CREATE POLICY "School admin can update own school"
ON public.schools FOR UPDATE
TO authenticated
USING (public.is_school_admin_of(id, auth.uid()))
WITH CHECK (public.is_school_admin_of(id, auth.uid()));

CREATE POLICY "Members can read their school"
ON public.schools FOR SELECT
TO authenticated
USING (id = public.get_user_school_id(auth.uid()));

-- Rozšíření RLS pro profiles
CREATE POLICY "School admin can read profiles in own school"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
);

CREATE POLICY "School admin can update profiles in own school"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
)
WITH CHECK (
  public.is_school_admin(auth.uid())
  AND school_id = public.get_user_school_id(auth.uid())
);

-- Rozšíření RLS pro user_roles
CREATE POLICY "School admin can read roles in own school"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.school_id = public.get_user_school_id(auth.uid())
  )
);

CREATE POLICY "School admin can grant teacher/user roles in own school"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_school_admin(auth.uid())
  AND role IN ('teacher', 'user')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.school_id = public.get_user_school_id(auth.uid())
  )
);

CREATE POLICY "School admin can revoke teacher/user roles in own school"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND role IN ('teacher', 'user')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.school_id = public.get_user_school_id(auth.uid())
  )
);

-- Rozšíření RLS pro classes
CREATE POLICY "School admin can read classes in own school"
ON public.classes FOR SELECT
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
);

CREATE POLICY "School admin can insert classes in own school"
ON public.classes FOR INSERT
TO authenticated
WITH CHECK (
  public.is_school_admin(auth.uid())
  AND school_id = public.get_user_school_id(auth.uid())
);

CREATE POLICY "School admin can update classes in own school"
ON public.classes FOR UPDATE
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND school_id = public.get_user_school_id(auth.uid())
)
WITH CHECK (
  public.is_school_admin(auth.uid())
  AND school_id = public.get_user_school_id(auth.uid())
);

CREATE POLICY "School admin can delete classes in own school"
ON public.classes FOR DELETE
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND school_id = public.get_user_school_id(auth.uid())
);