
-- 1. Auto-approve on email confirm
CREATE OR REPLACE FUNCTION public.auto_approve_on_email_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'approved'
    WHERE id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_on_email_confirm();

-- 2. Update handle_new_user to always set approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _class_code text;
  _school_code text;
  _role_label text;
  _assigned_role app_role;
  _status text;
BEGIN
  _role_label := COALESCE(NEW.raw_user_meta_data->>'role_label', 'student');
  _status := 'approved';

  BEGIN
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
      _status::public.account_status
    );
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.profiles
      SET email = COALESCE(NEW.email, email)
      WHERE id = NEW.id;
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  IF _role_label = 'teacher' THEN
    _assigned_role := 'teacher';
  ELSIF _role_label = 'rodic' THEN
    _assigned_role := 'rodic';
  ELSE
    _assigned_role := 'user';
  END IF;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _assigned_role)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: role insert failed for %: %', NEW.id, SQLERRM;
  END;

  _class_code := NEW.raw_user_meta_data->>'class_code';
  IF _class_code IS NOT NULL AND _class_code != '' THEN
    BEGIN
      PERFORM public.join_class_by_code(_class_code, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: join_class failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  _school_code := NEW.raw_user_meta_data->>'school_code';
  IF _school_code IS NOT NULL AND _school_code != '' THEN
    BEGIN
      PERFORM public.join_school_by_code(_school_code, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: join_school failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Approve all existing pending
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';
