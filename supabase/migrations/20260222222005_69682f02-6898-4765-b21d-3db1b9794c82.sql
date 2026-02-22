
-- Create podcast_episodes table
CREATE TABLE public.podcast_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  published_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  audio_url TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read podcast_episodes"
  ON public.podcast_episodes FOR SELECT USING (true);

CREATE POLICY "Admin can insert podcast_episodes"
  ON public.podcast_episodes FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin can update podcast_episodes"
  ON public.podcast_episodes FOR UPDATE USING (is_admin());

CREATE POLICY "Admin can delete podcast_episodes"
  ON public.podcast_episodes FOR DELETE USING (is_admin());

-- Timestamp trigger
CREATE TRIGGER update_podcast_episodes_updated_at
  BEFORE UPDATE ON public.podcast_episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
