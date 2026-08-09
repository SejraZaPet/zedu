CREATE OR REPLACE FUNCTION public.tg_staff_task_assignee_restrict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_to = auth.uid()
     AND OLD.assigned_by IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.color IS DISTINCT FROM OLD.color
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
       OR NEW.related_organization_id IS DISTINCT FROM OLD.related_organization_id
       OR NEW.related_user_id IS DISTINCT FROM OLD.related_user_id THEN
      RAISE EXCEPTION 'Úkol může upravit jen zadavatel';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_task_assignee_restrict ON public.staff_tasks;
CREATE TRIGGER staff_task_assignee_restrict
BEFORE UPDATE ON public.staff_tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_staff_task_assignee_restrict();

DROP POLICY IF EXISTS "Pristup k podukolum podle nadrazeneho ukolu" ON public.staff_task_subitems;

CREATE POLICY "Subitems select by task participants"
ON public.staff_task_subitems FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
);

CREATE POLICY "Subitems insert by task owner"
ON public.staff_task_subitems FOR INSERT
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND t.assigned_by = auth.uid()
  )
);

CREATE POLICY "Subitems delete by task owner"
ON public.staff_task_subitems FOR DELETE
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND t.assigned_by = auth.uid()
  )
);

CREATE POLICY "Subitems update by task participants"
ON public.staff_task_subitems FOR UPDATE
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.tg_staff_subitem_assignee_restrict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_to uuid;
  v_assigned_by uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT assigned_to, assigned_by INTO v_assigned_to, v_assigned_by
  FROM public.staff_tasks WHERE id = OLD.task_id;

  IF v_assigned_to = auth.uid()
     AND v_assigned_by IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.task_id IS DISTINCT FROM OLD.task_id
       OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      RAISE EXCEPTION 'Položky checklistu může upravit jen zadavatel';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_subitem_assignee_restrict ON public.staff_task_subitems;
CREATE TRIGGER staff_subitem_assignee_restrict
BEFORE UPDATE ON public.staff_task_subitems
FOR EACH ROW EXECUTE FUNCTION public.tg_staff_subitem_assignee_restrict();