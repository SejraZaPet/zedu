ALTER TABLE public.avatar_items DROP CONSTRAINT IF EXISTS avatar_items_category_check;
ALTER TABLE public.avatar_items ADD CONSTRAINT avatar_items_category_check
  CHECK (category IN ('base','skin_tone','hairstyle','hair_color','eyes','eyebrow','mouth','outfit','face_accessory','head_accessory','background','frame','effect','badge','title'));

ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS mouth_id uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL;