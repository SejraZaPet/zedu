CREATE INDEX IF NOT EXISTS idx_textbook_lessons_topic_id ON public.textbook_lessons (topic_id);
CREATE INDEX IF NOT EXISTS idx_teacher_textbook_lessons_textbook_id ON public.teacher_textbook_lessons (textbook_id);
CREATE INDEX IF NOT EXISTS idx_teacher_textbooks_teacher_id ON public.teacher_textbooks (teacher_id);
CREATE INDEX IF NOT EXISTS idx_textbook_topics_subject_grade ON public.textbook_topics (subject, grade);