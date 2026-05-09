
-- 1) Generator function
CREATE OR REPLACE FUNCTION public.generate_school_registration_code()
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
    _code := '';
    FOR _i IN 1..6 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.schools WHERE registration_code = _code) INTO _exists;
    IF NOT _exists THEN
      RETURN _code;
    END IF;
  END LOOP;
END;
$$;

-- 2) Add column
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS registration_code text;

-- 3) Backfill
UPDATE public.schools
SET registration_code = public.generate_school_registration_code()
WHERE registration_code IS NULL;

-- 4) Constraints + default
ALTER TABLE public.schools
  ALTER COLUMN registration_code SET NOT NULL,
  ALTER COLUMN registration_code SET DEFAULT public.generate_school_registration_code();

CREATE UNIQUE INDEX IF NOT EXISTS schools_registration_code_key
  ON public.schools (registration_code);

-- 5) Allow any authenticated user to read schools.id by registration_code (needed for join_school_by_code RPC anyway, but RPC handles security)
-- We DO NOT add a broad SELECT policy - RPC below uses SECURITY DEFINER.

-- 6) RPC: join school by registration code (used at signup time and from profile)
CREATE OR REPLACE FUNCTION public.join_school_by_code(_code text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _school_id uuid;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 OR _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _school_id
  FROM public.schools
  WHERE upper(registration_code) = upper(trim(_code))
  LIMIT 1;

  IF _school_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET school_id = _school_id
  WHERE id = _user_id;

  RETURN _school_id;
END;
$$;

-- 7) RPC: regenerate registration code (only school_admin of that school or system admin)
CREATE OR REPLACE FUNCTION public.regenerate_school_registration_code(_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_code text;
BEGIN
  IF NOT (public.is_admin() OR public.is_school_admin_of(_school_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to regenerate this school code';
  END IF;

  _new_code := public.generate_school_registration_code();

  UPDATE public.schools
  SET registration_code = _new_code,
      updated_at = now()
  WHERE id = _school_id;

  RETURN _new_code;
END;
$$;

-- 8) Update handle_new_user to support teacher school_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _class_code text;
  _school_code text;
  _role_label text;
  _assigned_role app_role;
  _status text;
BEGIN
  _role_label := COALESCE(NEW.raw_user_meta_data->>'role_label', 'student');
  _status := COALESCE(NEW.raw_user_meta_data->>'status',
                      CASE WHEN _role_label = 'rodic' THEN 'approved' ELSE 'pending' END);

  INSERT INTO public.profiles (id, email, first_name, last_name, school, field_of_study, year, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'school', ''),
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'year' IS NOT NULL AND NEW.raw_user_meta_data->>'year' != '' 
      THEN (NEW.raw_user_meta_data->>'year')::integer 
      ELSE NULL 
    END,
    _status
  );

  IF _role_label = 'teacher' THEN
    _assigned_role := 'teacher';
  ELSIF _role_label = 'rodic' THEN
    _assigned_role := 'rodic';
  ELSE
    _assigned_role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _assigned_role);

  _class_code := NEW.raw_user_meta_data->>'class_code';
  IF _class_code IS NOT NULL AND _class_code != '' THEN
    PERFORM public.join_class_by_code(_class_code, NEW.id);
  END IF;

  _school_code := NEW.raw_user_meta_data->>'school_code';
  IF _school_code IS NOT NULL AND _school_code != '' THEN
    PERFORM public.join_school_by_code(_school_code, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
