ALTER TABLE public.class_schedule_slots ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.teacher_textbooks ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.question_bank_items ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_schedule_slots_subject_id ON public.class_schedule_slots(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_textbooks_subject_id ON public.teacher_textbooks(subject_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_subject_id ON public.worksheets(subject_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject_id ON public.lesson_plans(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_items_subject_id ON public.question_bank_items(subject_id);

-- Backfill by case-insensitive name match (label or slug)
UPDATE public.class_schedule_slots s SET subject_id = sub.id
FROM public.subjects sub
WHERE s.subject_id IS NULL AND s.subject_label IS NOT NULL
  AND lower(btrim(s.subject_label)) = lower(btrim(sub.name));

UPDATE public.worksheets w SET subject_id = sub.id
FROM public.subjects sub
WHERE w.subject_id IS NULL AND w.subject IS NOT NULL
  AND lower(btrim(w.subject)) = lower(btrim(sub.name));

UPDATE public.lesson_plans lp SET subject_id = sub.id
FROM public.subjects sub
WHERE lp.subject_id IS NULL AND lp.subject IS NOT NULL
  AND lower(btrim(lp.subject)) = lower(btrim(sub.name));

UPDATE public.question_bank_items q SET subject_id = sub.id
FROM public.subjects sub
WHERE q.subject_id IS NULL AND q.subject IS NOT NULL
  AND lower(btrim(q.subject)) = lower(btrim(sub.name));

UPDATE public.teacher_textbooks t SET subject_id = sub.id
FROM public.subjects sub
WHERE t.subject_id IS NULL AND t.subject IS NOT NULL
  AND lower(btrim(t.subject)) = lower(btrim(sub.name));

-- textbook slug -> subjects.name match via textbook_subjects
UPDATE public.teacher_textbooks t SET subject_id = sub.id
FROM public.textbook_subjects ts
JOIN public.subjects sub ON lower(btrim(sub.name)) = lower(btrim(ts.label))
WHERE t.subject_id IS NULL AND t.subject = ts.slug;