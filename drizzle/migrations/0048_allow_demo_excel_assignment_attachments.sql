CREATE OR REPLACE FUNCTION public.demo_storage_upload_ok(_name text, _metadata jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  c public.demo_config;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN true; END IF;
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  IF lower(coalesce(_name,'')) !~ '\.(png|jpe?g|webp|pdf|docx|pptx|xlsx|xls|csv)$' THEN RETURN false; END IF;
  IF coalesce((_metadata->>'size')::bigint, (_metadata->>'contentLength')::bigint, 0) > c.upload_max_bytes THEN RETURN false; END IF;
  IF coalesce(_metadata->>'mimetype','') ~* '^(video|audio)/' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM storage.objects o WHERE o.owner = uid OR o.owner_id = uid::text) >= c.upload_max_files THEN RETURN false; END IF;
  RETURN true;
END
$$;

GRANT EXECUTE ON FUNCTION public.demo_storage_upload_ok(text, jsonb) TO authenticated, anon, service_role;