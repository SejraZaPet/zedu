ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS related_group_id uuid REFERENCES public.subject_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notebooks_owner_group_uniq
  ON public.notebooks(owner_id, related_group_id) WHERE related_group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notebooks_owner_class_subject_uniq
  ON public.notebooks(owner_id, related_class_id, subject_id)
  WHERE related_group_id IS NULL AND subject_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._ensure_course_notebooks_for(_uid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; nb_id uuid; created int := 0;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  -- jen žáci: ne učitelé/admini, ne sdílené demo profily
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = _uid AND role IN ('teacher','lektor','admin','school_admin'))
     OR EXISTS (SELECT 1 FROM demo_shared_users WHERE user_id = _uid)
     OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = _uid) THEN
    RETURN 0;
  END IF;

  -- kurzy = skupiny
  FOR r IN
    SELECT g.id AS group_id, g.subject_id, s.name AS sname, g.name AS gname
    FROM subject_group_members m
    JOIN subject_groups g ON g.id = m.group_id AND NOT g.archived
    LEFT JOIN subjects s ON s.id = g.subject_id
    WHERE m.student_id = _uid
      AND NOT EXISTS (SELECT 1 FROM notebooks n WHERE n.owner_id = _uid AND n.related_group_id = g.id)
  LOOP
    INSERT INTO notebooks(owner_id, title, subject, subject_id, related_group_id, cover_color)
    VALUES (_uid, 'Sešit – ' || coalesce(r.sname, 'předmět') || ' (' || r.gname || ')', r.sname, r.subject_id, r.group_id, '#9B6CFF')
    ON CONFLICT DO NOTHING RETURNING id INTO nb_id;
    IF nb_id IS NOT NULL THEN
      INSERT INTO notebook_pages(notebook_id, page_order) VALUES (nb_id, 0);
      created := created + 1;
    END IF;
    nb_id := NULL;
  END LOOP;

  -- kurzy = předměty tříd z rozvrhu
  FOR r IN
    SELECT DISTINCT cm.class_id, sl.subject_id, s.name AS sname
    FROM class_members cm
    JOIN class_schedule_slots sl ON sl.class_id = cm.class_id AND sl.group_id IS NULL AND sl.subject_id IS NOT NULL
    JOIN subjects s ON s.id = sl.subject_id
    WHERE cm.user_id = _uid
  LOOP
    IF EXISTS (SELECT 1 FROM notebooks n WHERE n.owner_id = _uid AND n.related_class_id = r.class_id
               AND n.related_group_id IS NULL AND n.subject_id = r.subject_id) THEN
      CONTINUE;
    END IF;
    -- přiřaď starý sešit (třída + textový předmět), nezakládej duplicitní
    UPDATE notebooks SET subject_id = r.subject_id
    WHERE id = (SELECT n.id FROM notebooks n WHERE n.owner_id = _uid AND n.related_class_id = r.class_id
                AND n.related_group_id IS NULL AND n.subject_id IS NULL
                AND lower(trim(n.subject)) = lower(trim(r.sname))
                ORDER BY n.created_at LIMIT 1);
    IF FOUND THEN CONTINUE; END IF;
    INSERT INTO notebooks(owner_id, title, subject, subject_id, related_class_id, cover_color)
    VALUES (_uid, 'Sešit – ' || r.sname, r.sname, r.subject_id, r.class_id, '#9B6CFF')
    ON CONFLICT DO NOTHING RETURNING id INTO nb_id;
    IF nb_id IS NOT NULL THEN
      INSERT INTO notebook_pages(notebook_id, page_order) VALUES (nb_id, 0);
      created := created + 1;
    END IF;
    nb_id := NULL;
  END LOOP;
  RETURN created;
END $$;
REVOKE ALL ON FUNCTION public._ensure_course_notebooks_for(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_my_course_notebooks()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._ensure_course_notebooks_for(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.ensure_my_course_notebooks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_course_notebooks() TO authenticated;

CREATE OR REPLACE FUNCTION public._trg_course_notebooks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'class_members' THEN
      PERFORM public._ensure_course_notebooks_for(NEW.user_id);
    ELSE
      PERFORM public._ensure_course_notebooks_for(NEW.student_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; -- nikdy neblokovat přidání žáka
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._trg_course_notebooks() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER course_notebooks_on_class_member AFTER INSERT ON public.class_members
  FOR EACH ROW EXECUTE FUNCTION public._trg_course_notebooks();
CREATE TRIGGER course_notebooks_on_group_member AFTER INSERT ON public.subject_group_members
  FOR EACH ROW EXECUTE FUNCTION public._trg_course_notebooks();