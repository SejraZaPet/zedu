
CREATE TABLE public.creator_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_follows_unique UNIQUE (follower_id, creator_id),
  CONSTRAINT creator_follows_no_self CHECK (follower_id <> creator_id)
);

CREATE INDEX creator_follows_creator_idx ON public.creator_follows (creator_id);
CREATE INDEX creator_follows_follower_idx ON public.creator_follows (follower_id);

GRANT SELECT, INSERT, DELETE ON public.creator_follows TO authenticated;
GRANT ALL ON public.creator_follows TO service_role;

ALTER TABLE public.creator_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own follows"
  ON public.creator_follows FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid());

CREATE POLICY "Users follow as themselves"
  ON public.creator_follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid() AND follower_id <> creator_id);

CREATE POLICY "Users unfollow own"
  ON public.creator_follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

-- Public follower count (no sensitive data)
CREATE OR REPLACE FUNCTION public.get_follower_count(_creator_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.creator_follows WHERE creator_id = _creator_id;
$$;

REVOKE ALL ON FUNCTION public.get_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_follower_count(uuid) TO authenticated;

-- Fanout notifications to followers on new public share
CREATE OR REPLACE FUNCTION public._notify_followers_on_public_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_name text;
  _title text;
  _kind_label text;
BEGIN
  IF NEW.shared_with IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.status, 'active') <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), 'Kolega')
    INTO _creator_name
    FROM public.profiles WHERE id = NEW.shared_by;

  IF NEW.textbook_id IS NOT NULL THEN
    SELECT title INTO _title FROM public.teacher_textbooks WHERE id = NEW.textbook_id;
    _kind_label := 'učebnici';
  ELSIF NEW.worksheet_id IS NOT NULL THEN
    SELECT title INTO _title FROM public.worksheets WHERE id = NEW.worksheet_id;
    _kind_label := 'pracovní list';
  ELSIF NEW.lesson_plan_id IS NOT NULL THEN
    SELECT title INTO _title FROM public.lesson_plans WHERE id = NEW.lesson_plan_id;
    _kind_label := 'prezentaci';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, link, status, sent_at, payload)
  SELECT
    cf.follower_id,
    NEW.shared_by,
    'creator_new_public_share',
    'Nový obsah od sledovaného tvůrce',
    _creator_name || ' přidal/a nový obsah: „' || COALESCE(_title, 'materiál') || '"',
    '/Bezlimarket',
    'sent',
    now(),
    jsonb_build_object(
      'share_id', NEW.id,
      'creator_id', NEW.shared_by,
      'textbook_id', NEW.textbook_id,
      'worksheet_id', NEW.worksheet_id,
      'lesson_plan_id', NEW.lesson_plan_id
    )
  FROM public.creator_follows cf
  WHERE cf.creator_id = NEW.shared_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_on_public_share ON public.content_shares;
CREATE TRIGGER trg_notify_followers_on_public_share
AFTER INSERT ON public.content_shares
FOR EACH ROW
EXECUTE FUNCTION public._notify_followers_on_public_share();
