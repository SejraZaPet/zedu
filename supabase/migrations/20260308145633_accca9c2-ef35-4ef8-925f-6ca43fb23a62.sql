
-- Update the handle_new_user trigger to also join class by code
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _class_code text;
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
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Auto-join class by code if provided
  _class_code := NEW.raw_user_meta_data->>'class_code';
  IF _class_code IS NOT NULL AND _class_code != '' THEN
    PERFORM public.join_class_by_code(_class_code, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;
