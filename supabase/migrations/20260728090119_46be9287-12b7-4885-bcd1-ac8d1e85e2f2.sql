
-- 1. Class stories table
CREATE TABLE public.class_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_stories_class_created ON public.class_stories(class_id, created_at DESC);
CREATE INDEX idx_class_stories_teacher ON public.class_stories(teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_stories TO authenticated;
GRANT ALL ON public.class_stories TO service_role;

ALTER TABLE public.class_stories ENABLE ROW LEVEL SECURITY;

-- Teacher of the class: full CRUD on own posts
CREATE POLICY "Teachers in class can insert stories"
  ON public.class_stories FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_class_teacher(class_id, auth.uid())
  );

CREATE POLICY "Author teacher can update own stories"
  ON public.class_stories FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Author teacher can delete own stories"
  ON public.class_stories FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- Read: teachers of the class
CREATE POLICY "Teachers in class can read stories"
  ON public.class_stories FOR SELECT TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()));

-- Read: students who are class members
CREATE POLICY "Class members can read stories"
  ON public.class_stories FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = class_stories.class_id
        AND cm.user_id = auth.uid()
    )
  );

-- Read: parents whose child is in the class
CREATE POLICY "Parents of class members can read stories"
  ON public.class_stories FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      JOIN public.class_members cm ON cm.user_id = psl.student_id
      WHERE psl.parent_id = auth.uid()
        AND cm.class_id = class_stories.class_id
    )
  );

-- Admin
CREATE POLICY "Admin can manage class_stories"
  ON public.class_stories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Extend notifications type CHECK to include class_story_new
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'assignment_new',
    'assignment_submitted',
    'assignment_deadline_soon',
    'class_textbook_added',
    'class_teacher_invited',
    'admin_message',
    'reminder',
    'message',
    'warning',
    'info',
    'update',
    'hand_raised',
    'inactive_student',
    'struggling_topic',
    'content_shared',
    'creator_follow',
    'class_story_new'
  ));

-- 3. Trigger: fanout notifications to parents on new class_story
CREATE OR REPLACE FUNCTION public.notify_on_class_story()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _class_name text;
  _preview text;
BEGIN
  SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;
  _preview := CASE
    WHEN length(NEW.text) > 140 THEN substr(NEW.text, 1, 140) || '…'
    ELSE NEW.text
  END;

  INSERT INTO public.notifications (
    recipient_id, sender_id, sender_role, type, title, body,
    payload, link, status, sent_at, is_manual
  )
  SELECT DISTINCT
    psl.parent_id,
    NEW.teacher_id,
    'teacher',
    'class_story_new',
    'Nový příspěvek ze třídy ' || COALESCE(_class_name, ''),
    COALESCE(_preview, ''),
    jsonb_build_object('class_id', NEW.class_id, 'story_id', NEW.id),
    '/rodic',
    'sent',
    now(),
    false
  FROM public.parent_student_links psl
  JOIN public.class_members cm ON cm.user_id = psl.student_id
  WHERE cm.class_id = NEW.class_id
    AND psl.parent_id <> NEW.teacher_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_story_notify ON public.class_stories;
CREATE TRIGGER trg_class_story_notify
AFTER INSERT ON public.class_stories
FOR EACH ROW EXECUTE FUNCTION public.notify_on_class_story();

-- 4. Storage policies for class-stories bucket (reuse lesson-images or create separate).
-- Use lesson-images bucket which already allows teacher uploads.
