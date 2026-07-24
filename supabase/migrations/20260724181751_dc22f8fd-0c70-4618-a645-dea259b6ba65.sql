
DROP TABLE IF EXISTS public.marketplace_reviews CASCADE;
DROP TABLE IF EXISTS public.marketplace_purchases CASCADE;
DROP TABLE IF EXISTS public.marketplace_listings CASCADE;
DROP FUNCTION IF EXISTS public.bump_listing_downloads() CASCADE;
DROP FUNCTION IF EXISTS public.recompute_listing_rating() CASCADE;

ALTER TABLE public.teacher_textbooks
  ADD COLUMN IF NOT EXISTS grade_level text[],
  ADD COLUMN IF NOT EXISTS school_type text[];

ALTER TABLE public.teacher_textbooks
  DROP CONSTRAINT IF EXISTS teacher_textbooks_grade_level_check;
ALTER TABLE public.teacher_textbooks
  ADD CONSTRAINT teacher_textbooks_grade_level_check
  CHECK (grade_level IS NULL OR grade_level <@ ARRAY['zs1','zs2','ss','vs']::text[]);

CREATE TABLE public.content_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id uuid REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE,
  worksheet_id uuid REFERENCES public.worksheets(id) ON DELETE CASCADE,
  lesson_plan_id uuid REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  includes_worksheets boolean NOT NULL DEFAULT false,
  includes_presentations boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_shares_exactly_one_target CHECK (
    (textbook_id IS NOT NULL)::int
    + (worksheet_id IS NOT NULL)::int
    + (lesson_plan_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_content_shares_shared_by ON public.content_shares(shared_by);
CREATE INDEX idx_content_shares_shared_with ON public.content_shares(shared_with);
CREATE INDEX idx_content_shares_public ON public.content_shares(created_at DESC) WHERE shared_with IS NULL;
CREATE INDEX idx_content_shares_textbook ON public.content_shares(textbook_id) WHERE textbook_id IS NOT NULL;
CREATE INDEX idx_content_shares_worksheet ON public.content_shares(worksheet_id) WHERE worksheet_id IS NOT NULL;
CREATE INDEX idx_content_shares_lesson_plan ON public.content_shares(lesson_plan_id) WHERE lesson_plan_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_shares TO authenticated;
GRANT ALL ON public.content_shares TO service_role;

ALTER TABLE public.content_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own shares"
  ON public.content_shares
  FOR ALL TO authenticated
  USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Recipient reads direct shares"
  ON public.content_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

CREATE POLICY "Teachers read public shares"
  ON public.content_shares
  FOR SELECT TO authenticated
  USING (
    shared_with IS NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('teacher','admin')
      )
    )
  );

CREATE POLICY "Admin reads all shares"
  ON public.content_shares
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE VIEW public.textbook_marketplace_stats
WITH (security_invoker = true) AS
SELECT
  tt.id                                            AS textbook_id,
  tt.title,
  tt.subject,
  tt.grade_level,
  tt.school_type,
  tt.teacher_id,
  NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), '') AS author,
  COALESCE(s.total_shares, 0)                      AS total_shares,
  COALESCE(s.public_shares, 0)                     AS public_shares,
  COALESCE(s.direct_shares, 0)                     AS direct_shares,
  COALESCE(s.has_materials, false)                 AS has_materials,
  COALESCE(c.used_in_classes, 0)                   AS used_in_classes
FROM public.teacher_textbooks tt
LEFT JOIN public.profiles p ON p.id = tt.teacher_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                         AS total_shares,
    COUNT(*) FILTER (WHERE shared_with IS NULL)      AS public_shares,
    COUNT(*) FILTER (WHERE shared_with IS NOT NULL)  AS direct_shares,
    bool_or(includes_worksheets OR includes_presentations) AS has_materials
  FROM public.content_shares cs
  WHERE cs.textbook_id = tt.id
) s ON true
LEFT JOIN LATERAL (
  SELECT COUNT(DISTINCT ct.class_id) AS used_in_classes
  FROM public.class_textbooks ct
  WHERE ct.textbook_id = tt.id
) c ON true;

GRANT SELECT ON public.textbook_marketplace_stats TO authenticated;
GRANT SELECT ON public.textbook_marketplace_stats TO service_role;
