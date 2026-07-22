
-- 1) layer_slot column on avatar_items
ALTER TABLE public.avatar_items
  ADD COLUMN IF NOT EXISTS layer_slot text;

ALTER TABLE public.avatar_items
  DROP CONSTRAINT IF EXISTS avatar_items_layer_slot_check;

ALTER TABLE public.avatar_items
  ADD CONSTRAINT avatar_items_layer_slot_check
  CHECK (layer_slot IS NULL OR layer_slot IN (
    'hair',
    'hair_accessory',
    'clothing_top',
    'clothing_bottom',
    'clothing_full',
    'clothing_shoes',
    'clothing_head',
    'clothing_face',
    'clothing_neck',
    'clothing_hands',
    'clothing_bag'
  ));

CREATE INDEX IF NOT EXISTS idx_avatar_items_layer_slot
  ON public.avatar_items(layer_slot) WHERE layer_slot IS NOT NULL;

-- Backfill existing hairstyle items
UPDATE public.avatar_items
   SET layer_slot = 'hair'
 WHERE category = 'hairstyle' AND layer_slot IS NULL;

-- 2) Per-slot columns on avatar_profiles (one item per slot max)
ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS clothing_top_id     uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_bottom_id  uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_full_id    uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_shoes_id   uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_head_id    uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_face_id    uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_neck_id    uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_hands_id   uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clothing_bag_id     uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hair_accessory_id   uuid REFERENCES public.avatar_items(id) ON DELETE SET NULL;

-- 3) First test item: basic t-shirt (image to be uploaded later)
INSERT INTO public.avatar_items (slug, name, category, layer_slot, rarity, unlock_type, is_default, sort_order, icon_name)
VALUES ('tshirt_basic', 'Základní triko', 'outfit', 'clothing_top', 'common', 'default', true, 0, 'Shirt')
ON CONFLICT (slug) DO UPDATE
  SET layer_slot = EXCLUDED.layer_slot,
      category   = EXCLUDED.category,
      updated_at = now();
