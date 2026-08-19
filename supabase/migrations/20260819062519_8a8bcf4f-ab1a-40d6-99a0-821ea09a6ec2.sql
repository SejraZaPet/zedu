ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS assigned_by uuid;
CREATE INDEX IF NOT EXISTS idx_todos_assigned_by ON public.todos(assigned_by);

CREATE POLICY "Assigners can view delegated todos"
ON public.todos FOR SELECT TO authenticated
USING (assigned_by = auth.uid());

CREATE POLICY "Assigners can update delegated todo status"
ON public.todos FOR UPDATE TO authenticated
USING (assigned_by = auth.uid())
WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "Assigners can delete delegated todos"
ON public.todos FOR DELETE TO authenticated
USING (assigned_by = auth.uid());

CREATE POLICY "Colleagues can create todos for same school"
ON public.todos FOR INSERT TO authenticated
WITH CHECK (
  assigned_by = auth.uid()
  AND user_id <> auth.uid()
  AND public.get_user_school_id(auth.uid()) IS NOT NULL
  AND public.get_user_school_id(user_id) = public.get_user_school_id(auth.uid())
);

CREATE OR REPLACE FUNCTION public.tg_todos_assigner_content_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_by IS NOT NULL
     AND auth.uid() = NEW.assigned_by
     AND auth.uid() <> NEW.user_id THEN
    NEW.title := OLD.title;
    NEW.description := OLD.description;
    NEW.due_date := OLD.due_date;
    NEW.priority := OLD.priority;
    NEW.type := OLD.type;
    NEW.user_id := OLD.user_id;
    NEW.assigned_by := OLD.assigned_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_todos_assigner_content_guard
BEFORE UPDATE ON public.todos
FOR EACH ROW EXECUTE FUNCTION public.tg_todos_assigner_content_guard();