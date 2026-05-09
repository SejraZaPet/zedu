ALTER TABLE public.assignments ADD COLUMN exam_type text NULL;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_exam_type_check CHECK (exam_type IS NULL OR exam_type IN ('ustni','pisemne','digitalni','projekt'));
CREATE INDEX IF NOT EXISTS idx_assignments_exam_type ON public.assignments(exam_type);