
-- Classes table
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  school text NOT NULL DEFAULT '',
  field_of_study text NOT NULL DEFAULT '',
  year integer,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Class members junction table
CREATE TABLE public.class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- RLS for classes
CREATE POLICY "Admin can read classes" ON public.classes FOR SELECT USING (is_admin());
CREATE POLICY "Admin can insert classes" ON public.classes FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update classes" ON public.classes FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete classes" ON public.classes FOR DELETE USING (is_admin());

-- RLS for class_members
CREATE POLICY "Admin can read class_members" ON public.class_members FOR SELECT USING (is_admin());
CREATE POLICY "Admin can insert class_members" ON public.class_members FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can delete class_members" ON public.class_members FOR DELETE USING (is_admin());

-- Updated_at trigger for classes
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
