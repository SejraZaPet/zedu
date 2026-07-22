ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS clothing_top_color text,
  ADD COLUMN IF NOT EXISTS clothing_bottom_color text,
  ADD COLUMN IF NOT EXISTS clothing_full_color text,
  ADD COLUMN IF NOT EXISTS clothing_shoes_color text,
  ADD COLUMN IF NOT EXISTS clothing_head_color text,
  ADD COLUMN IF NOT EXISTS clothing_face_color text,
  ADD COLUMN IF NOT EXISTS clothing_neck_color text,
  ADD COLUMN IF NOT EXISTS clothing_hands_color text,
  ADD COLUMN IF NOT EXISTS clothing_bag_color text,
  ADD COLUMN IF NOT EXISTS hair_accessory_color text;