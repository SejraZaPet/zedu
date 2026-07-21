
ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS base_color            text,
  ADD COLUMN IF NOT EXISTS hairstyle_color       text,
  ADD COLUMN IF NOT EXISTS outfit_color          text,
  ADD COLUMN IF NOT EXISTS face_accessory_color  text,
  ADD COLUMN IF NOT EXISTS head_accessory_color  text;

UPDATE public.avatar_profiles p SET
  base_color = COALESCE(p.base_color, (SELECT ai.color_value FROM public.avatar_items ai WHERE ai.id = p.skin_tone_id)),
  hairstyle_color = COALESCE(p.hairstyle_color, (SELECT ai.color_value FROM public.avatar_items ai WHERE ai.id = p.hair_color_id))
WHERE p.skin_tone_id IS NOT NULL OR p.hair_color_id IS NOT NULL;

UPDATE public.avatar_items
   SET is_active = false
 WHERE category IN ('skin_tone','hair_color')
   AND is_active = true;
