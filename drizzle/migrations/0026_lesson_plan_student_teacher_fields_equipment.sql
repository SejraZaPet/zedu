ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS student_description text NULL, ADD COLUMN IF NOT EXISTS teacher_instructions text NULL;
ALTER TABLE public.lesson_plan_phases ADD COLUMN IF NOT EXISTS equipment text NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_plan_phases_plan ON public.lesson_plan_phases(lesson_plan_id);
COMMENT ON COLUMN public.lesson_plans.student_description IS 'Zadání pro žáky (viditelné při zveřejnění)';
COMMENT ON COLUMN public.lesson_plans.teacher_instructions IS 'Instrukce pro učitele – jen pro učitele';
COMMENT ON COLUMN public.lesson_plan_phases.equipment IS 'Pomůcky pro fázi – jen pro učitele';