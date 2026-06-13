
-- Create public branding view exposing only safe fields
CREATE OR REPLACE VIEW public.schools_public AS
SELECT id, name, subdomain, custom_logo_url, custom_primary_color, custom_welcome_text, registration_code
FROM public.schools;

ALTER VIEW public.schools_public SET (security_invoker = false);

GRANT SELECT ON public.schools_public TO anon, authenticated;

-- Drop the overly broad SELECT policies on schools; admin/school_admin policies remain
DROP POLICY IF EXISTS "Public can read school branding by subdomain" ON public.schools;
DROP POLICY IF EXISTS "Members can read their school" ON public.schools;
