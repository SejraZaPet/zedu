
-- 1. Clean up orphaned lesson_topic_assignments (referencing non-existent lessons)
DELETE FROM public.lesson_topic_assignments
WHERE lesson_id NOT IN (SELECT id FROM public.lessons);

-- 2. Clean up orphaned student_activity_results (referencing non-existent textbook_lessons)
DELETE FROM public.student_activity_results
WHERE lesson_id NOT IN (SELECT id FROM public.textbook_lessons);

-- 3. Clean up orphaned student_lesson_completions
DELETE FROM public.student_lesson_completions
WHERE lesson_id NOT IN (SELECT id FROM public.textbook_lessons);

-- 4. Fix foreign keys: Add ON DELETE CASCADE to lesson_topic_assignments -> lessons
ALTER TABLE public.lesson_topic_assignments
  DROP CONSTRAINT IF EXISTS lesson_topic_assignments_lesson_id_fkey;
ALTER TABLE public.lesson_topic_assignments
  ADD CONSTRAINT lesson_topic_assignments_lesson_id_fkey
  FOREIGN KEY (lesson_id) REFERENCES public.textbook_lessons(id) ON DELETE CASCADE;

-- 5. Fix foreign keys: Add ON DELETE CASCADE to lesson_topic_assignments -> textbook_topics
ALTER TABLE public.lesson_topic_assignments
  DROP CONSTRAINT IF EXISTS lesson_topic_assignments_topic_id_fkey;
ALTER TABLE public.lesson_topic_assignments
  ADD CONSTRAINT lesson_topic_assignments_topic_id_fkey
  FOREIGN KEY (topic_id) REFERENCES public.textbook_topics(id) ON DELETE CASCADE;

-- 6. Fix foreign keys: Add ON DELETE CASCADE to textbook_lessons -> textbook_topics
ALTER TABLE public.textbook_lessons
  DROP CONSTRAINT IF EXISTS textbook_lessons_topic_id_fkey;
ALTER TABLE public.textbook_lessons
  ADD CONSTRAINT textbook_lessons_topic_id_fkey
  FOREIGN KEY (topic_id) REFERENCES public.textbook_topics(id) ON DELETE CASCADE;

-- 7. Fix foreign keys: student_activity_results -> textbook_lessons CASCADE
ALTER TABLE public.student_activity_results
  DROP CONSTRAINT IF EXISTS student_activity_results_lesson_id_fkey;
ALTER TABLE public.student_activity_results
  ADD CONSTRAINT student_activity_results_lesson_id_fkey
  FOREIGN KEY (lesson_id) REFERENCES public.textbook_lessons(id) ON DELETE CASCADE;

-- 8. Fix foreign keys: student_lesson_completions -> textbook_lessons CASCADE
ALTER TABLE public.student_lesson_completions
  DROP CONSTRAINT IF EXISTS student_lesson_completions_lesson_id_fkey;
ALTER TABLE public.student_lesson_completions
  ADD CONSTRAINT student_lesson_completions_lesson_id_fkey
  FOREIGN KEY (lesson_id) REFERENCES public.textbook_lessons(id) ON DELETE CASCADE;

-- 9. Fix foreign keys: teacher_textbook_lessons -> teacher_textbooks CASCADE
ALTER TABLE public.teacher_textbook_lessons
  DROP CONSTRAINT IF EXISTS teacher_textbook_lessons_textbook_id_fkey;
ALTER TABLE public.teacher_textbook_lessons
  ADD CONSTRAINT teacher_textbook_lessons_textbook_id_fkey
  FOREIGN KEY (textbook_id) REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE;

-- 10. Fix foreign keys: teacher_textbook_enrollments -> teacher_textbooks CASCADE
ALTER TABLE public.teacher_textbook_enrollments
  DROP CONSTRAINT IF EXISTS teacher_textbook_enrollments_textbook_id_fkey;
ALTER TABLE public.teacher_textbook_enrollments
  ADD CONSTRAINT teacher_textbook_enrollments_textbook_id_fkey
  FOREIGN KEY (textbook_id) REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE;

-- 11. Fix foreign keys: textbook_grades -> textbook_subjects CASCADE
ALTER TABLE public.textbook_grades
  DROP CONSTRAINT IF EXISTS textbook_grades_subject_id_fkey;
ALTER TABLE public.textbook_grades
  ADD CONSTRAINT textbook_grades_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.textbook_subjects(id) ON DELETE CASCADE;
