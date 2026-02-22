
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Articles table
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  published_date DATE NOT NULL DEFAULT CURRENT_DATE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Section links table
CREATE TABLE public.section_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.section_links ENABLE ROW LEVEL SECURITY;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_section_links_updated_at BEFORE UPDATE ON public.section_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Public can read content, only admin can modify
-- Lessons
CREATE POLICY "Anyone can read lessons" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "Admin can insert lessons" ON public.lessons FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update lessons" ON public.lessons FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete lessons" ON public.lessons FOR DELETE USING (public.is_admin());

-- Articles
CREATE POLICY "Anyone can read articles" ON public.articles FOR SELECT USING (true);
CREATE POLICY "Admin can insert articles" ON public.articles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update articles" ON public.articles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete articles" ON public.articles FOR DELETE USING (public.is_admin());

-- Section links
CREATE POLICY "Anyone can read section_links" ON public.section_links FOR SELECT USING (true);
CREATE POLICY "Admin can insert section_links" ON public.section_links FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update section_links" ON public.section_links FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete section_links" ON public.section_links FOR DELETE USING (public.is_admin());

-- User roles: only admin can manage
CREATE POLICY "Admin can read user_roles" ON public.user_roles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can insert user_roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update user_roles" ON public.user_roles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete user_roles" ON public.user_roles FOR DELETE USING (public.is_admin());
