
-- Add access_code columns to classes table
ALTER TABLE public.classes ADD COLUMN access_code text UNIQUE DEFAULT NULL;
ALTER TABLE public.classes ADD COLUMN access_code_active boolean NOT NULL DEFAULT false;

-- Create a function to join class by code (callable by any authenticated user)
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _class_id uuid;
BEGIN
  SELECT id INTO _class_id
  FROM public.classes
  WHERE access_code = _code
    AND access_code_active = true
    AND archived = false;

  IF _class_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.class_members (class_id, user_id)
  VALUES (_class_id, _user_id)
  ON CONFLICT DO NOTHING;

  RETURN _class_id;
END;
$$;
