
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subdomain text UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_logo_url text,
  ADD COLUMN IF NOT EXISTS custom_primary_color text,
  ADD COLUMN IF NOT EXISTS custom_welcome_text text;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_subdomain_format
  CHECK (subdomain IS NULL OR subdomain ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$');

CREATE INDEX IF NOT EXISTS idx_schools_subdomain ON public.schools(subdomain);

-- Public read of branding fields by subdomain (for unauthenticated Auth page)
DROP POLICY IF EXISTS "Public can read school branding by subdomain" ON public.schools;
CREATE POLICY "Public can read school branding by subdomain"
ON public.schools
FOR SELECT
TO anon, authenticated
USING (subdomain IS NOT NULL);

-- Storage bucket for school logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read logos
DROP POLICY IF EXISTS "Public read school logos" ON storage.objects;
CREATE POLICY "Public read school logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-logos');

-- School admins (or system admins) can upload/update/delete logos for their school
-- Path convention: {school_id}/logo.<ext>
DROP POLICY IF EXISTS "School admin upload school logo" ON storage.objects;
CREATE POLICY "School admin upload school logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'school-logos'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "School admin update school logo" ON storage.objects;
CREATE POLICY "School admin update school logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'school-logos'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "School admin delete school logo" ON storage.objects;
CREATE POLICY "School admin delete school logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'school-logos'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);
