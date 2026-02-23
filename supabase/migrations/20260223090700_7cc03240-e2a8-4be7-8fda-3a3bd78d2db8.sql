
-- Create junction table for lesson-topic assignments (many-to-many)
CREATE TABLE public.lesson_topic_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.textbook_lessons(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.textbook_topics(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, topic_id)
);

-- Enable RLS
ALTER TABLE public.lesson_topic_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read lesson_topic_assignments"
ON public.lesson_topic_assignments FOR SELECT USING (true);

CREATE POLICY "Admin can insert lesson_topic_assignments"
ON public.lesson_topic_assignments FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin can update lesson_topic_assignments"
ON public.lesson_topic_assignments FOR UPDATE USING (is_admin());

CREATE POLICY "Admin can delete lesson_topic_assignments"
ON public.lesson_topic_assignments FOR DELETE USING (is_admin());

-- Index for fast lookups
CREATE INDEX idx_lta_lesson_id ON public.lesson_topic_assignments(lesson_id);
CREATE INDEX idx_lta_topic_id ON public.lesson_topic_assignments(topic_id);

-- Migrate existing data: create assignment for each lesson's current topic_id
INSERT INTO public.lesson_topic_assignments (lesson_id, topic_id, sort_order)
SELECT id, topic_id, sort_order FROM public.textbook_lessons;
