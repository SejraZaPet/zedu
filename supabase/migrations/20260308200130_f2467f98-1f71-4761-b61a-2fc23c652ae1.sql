CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _class_code text;
  _role_label text;
  _assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, school, field_of_study, year)
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
    END
  );
  
  -- Determine role from registration metadata
  _role_label := COALESCE(NEW.raw_user_meta_data->>'role_label', 'student');
  IF _role_label = 'teacher' THEN
    _assigned_role := 'teacher';
  ELSE
    _assigned_role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _assigned_role);

  -- Auto-join class by code if provided
  _class_code := NEW.raw_user_meta_data->>'class_code';
  IF _class_code IS NOT NULL AND _class_code != '' THEN
    PERFORM public.join_class_by_code(_class_code, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;