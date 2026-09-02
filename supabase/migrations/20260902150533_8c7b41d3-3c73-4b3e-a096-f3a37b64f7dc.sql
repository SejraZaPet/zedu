CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;