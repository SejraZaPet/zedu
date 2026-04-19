-- Add "rodic" to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'rodic';

-- Create parent-student relationship table
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can read their own links"
ON public.parent_student_links FOR SELECT
TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Admins can manage parent links"
ON public.parent_student_links FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'teacher')
  )
);