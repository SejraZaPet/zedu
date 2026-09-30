ALTER TABLE public.subject_group_textbooks ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
UPDATE public.subject_group_textbooks t SET subject_id = g.subject_id FROM public.subject_groups g WHERE g.id = t.subject_group_id AND t.subject_id IS NULL;
ALTER TABLE public.subject_group_textbooks DROP CONSTRAINT IF EXISTS subject_group_textbooks_subject_group_id_textbook_id_textbook_type_key;
ALTER TABLE public.subject_group_textbooks ADD CONSTRAINT subject_group_textbooks_group_subject_textbook_key UNIQUE NULLS NOT DISTINCT (subject_group_id, subject_id, textbook_id, textbook_type);
CREATE INDEX IF NOT EXISTS subject_group_textbooks_subject_idx ON public.subject_group_textbooks(subject_id);