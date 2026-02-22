
-- Textbook topics (Předmět → Ročník → Téma)
CREATE TABLE public.textbook_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.textbook_topics ENABLE ROW LEVEL SECURITY;

-- Textbook lessons (Lekce within topics)
CREATE TABLE public.textbook_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.textbook_topics(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  hero_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.textbook_lessons ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_textbook_topics_updated_at BEFORE UPDATE ON public.textbook_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_textbook_lessons_updated_at BEFORE UPDATE ON public.textbook_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Public read, admin write
CREATE POLICY "Anyone can read textbook_topics" ON public.textbook_topics FOR SELECT USING (true);
CREATE POLICY "Admin can insert textbook_topics" ON public.textbook_topics FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update textbook_topics" ON public.textbook_topics FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete textbook_topics" ON public.textbook_topics FOR DELETE USING (public.is_admin());

CREATE POLICY "Anyone can read textbook_lessons" ON public.textbook_lessons FOR SELECT USING (true);
CREATE POLICY "Admin can insert textbook_lessons" ON public.textbook_lessons FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update textbook_lessons" ON public.textbook_lessons FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete textbook_lessons" ON public.textbook_lessons FOR DELETE USING (public.is_admin());

-- Storage bucket for lesson images
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-images', 'lesson-images', true);

CREATE POLICY "Anyone can view lesson images" ON storage.objects FOR SELECT USING (bucket_id = 'lesson-images');
CREATE POLICY "Admin can upload lesson images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lesson-images' AND public.is_admin());
CREATE POLICY "Admin can update lesson images" ON storage.objects FOR UPDATE USING (bucket_id = 'lesson-images' AND public.is_admin());
CREATE POLICY "Admin can delete lesson images" ON storage.objects FOR DELETE USING (bucket_id = 'lesson-images' AND public.is_admin());
