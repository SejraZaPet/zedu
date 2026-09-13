-- 1) Povolené úrovně viditelnosti učebnice
ALTER TABLE public.teacher_textbooks
  DROP CONSTRAINT IF EXISTS teacher_textbooks_visibility_chk;
ALTER TABLE public.teacher_textbooks
  ADD CONSTRAINT teacher_textbooks_visibility_chk
  CHECK (visibility IN ('private', 'shared', 'public'));

-- 2) Úroveň se vždy počítá ze skutečných sdílení (content_shares)
CREATE OR REPLACE FUNCTION public.compute_textbook_visibility(_textbook_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.content_shares
      WHERE textbook_id = _textbook_id AND shared_with IS NULL AND status = 'active'
    ) THEN 'public'
    WHEN EXISTS (
      SELECT 1 FROM public.content_shares
      WHERE textbook_id = _textbook_id AND shared_with IS NOT NULL AND status = 'active'
    ) THEN 'shared'
    ELSE 'private'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_textbook_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ids uuid[];
  _id uuid;
BEGIN
  _ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.textbook_id ELSE NULL END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.textbook_id ELSE NULL END
    ]) AS t(x) WHERE x IS NOT NULL
  );
  FOREACH _id IN ARRAY _ids LOOP
    UPDATE public.teacher_textbooks
      SET visibility = public.compute_textbook_visibility(_id)
      WHERE id = _id
        AND visibility <> public.compute_textbook_visibility(_id);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_textbook_visibility ON public.content_shares;
CREATE TRIGGER tg_sync_textbook_visibility
AFTER INSERT OR UPDATE OR DELETE ON public.content_shares
FOR EACH ROW EXECUTE FUNCTION public.sync_textbook_visibility();

-- 3) Ruční změna pole nesmí předstírat jinou úroveň, než odpovídá sdílením
CREATE OR REPLACE FUNCTION public.enforce_textbook_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.visibility := public.compute_textbook_visibility(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_enforce_textbook_visibility ON public.teacher_textbooks;
CREATE TRIGGER tg_enforce_textbook_visibility
BEFORE UPDATE OF visibility ON public.teacher_textbooks
FOR EACH ROW EXECUTE FUNCTION public.enforce_textbook_visibility();

-- 4) Dorovnání existujících dat
UPDATE public.teacher_textbooks t
  SET visibility = public.compute_textbook_visibility(t.id)
  WHERE t.visibility <> public.compute_textbook_visibility(t.id);