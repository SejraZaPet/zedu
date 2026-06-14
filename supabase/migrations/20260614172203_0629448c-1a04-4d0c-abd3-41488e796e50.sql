CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _class_code text;
  _school_code text;
  _child_code text;
  _student_id uuid;
  _role_label text;
  _status_label text;
  _assigned_role app_role;
  _assigned_status public.account_status;
BEGIN
  BEGIN
    _role_label := COALESCE(NEW.raw_user_meta_data->>'role_label', 'student');
    _status_label := COALESCE(NEW.raw_user_meta_data->>'status', 'pending');

    IF _status_label = 'approved' THEN
      _assigned_status := 'approved'::public.account_status;
    ELSIF _status_label = 'blocked' THEN
      _assigned_status := 'blocked'::public.account_status;
    ELSE
      _assigned_status := 'pending'::public.account_status;
    END IF;

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
        _assigned_status
      );
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.profiles SET email = COALESCE(NEW.email, email) WHERE id = NEW.id;
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
      ON CONFLICT (user_id, role) DO NOTHING;
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

    _child_code := NEW.raw_user_meta_data->>'child_code';
    IF _child_code IS NOT NULL AND _child_code != '' THEN
      BEGIN
        SELECT s.id INTO _student_id
        FROM public.find_student_by_code(_child_code) AS s
        LIMIT 1;

        IF _student_id IS NOT NULL THEN
          INSERT INTO public.parent_student_links (parent_id, student_id)
          VALUES (NEW.id, _student_id)
          ON CONFLICT DO NOTHING;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: child_code link failed for %: %', NEW.id, SQLERRM;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: unexpected top-level error for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;