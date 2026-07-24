ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lektor';

DROP POLICY IF EXISTS "Teachers read public shares" ON public.content_shares;
DROP POLICY IF EXISTS "Teachers and lecturers read public shares" ON public.content_shares;

CREATE POLICY "Teachers and lecturers read public shares"
  ON public.content_shares
  FOR SELECT TO authenticated
  USING (
    shared_with IS NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('teacher','lektor','admin')
      )
    )
  );