
ALTER TABLE public.avatar_items DROP CONSTRAINT IF EXISTS avatar_items_category_check;
ALTER TABLE public.avatar_items ADD CONSTRAINT avatar_items_category_check
  CHECK (category IN ('base','skin_tone','hairstyle','hair_color','eyes','eyebrow','outfit','face_accessory','head_accessory','background','frame','effect','badge','title'));

ALTER TABLE public.avatar_profiles ADD COLUMN IF NOT EXISTS eyebrow_id uuid REFERENCES public.avatar_items(id);

INSERT INTO public.avatar_items (slug, name, category, rarity, recommended_for_role, unlock_type, is_default, is_active, layer_offset_x, layer_offset_y, layer_scale, sort_order, image_url)
VALUES
('eyebrow_normal','Základní','eyebrow','common','both','default',true,true,0,0,1,1,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_1.png'),
('eyebrow_thin','Tenké','eyebrow','common','both','default',true,true,0,0,1,2,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_2.png'),
('eyebrow_angry','Nasupené','eyebrow','common','both','default',true,true,0,0,1,3,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_3.png'),
('eyebrow_raised','Zvednuté','eyebrow','common','both','default',true,true,0,0,1,4,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_4.png'),
('eyebrow_worried','Ustarané','eyebrow','common','both','default',true,true,0,0,1,5,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_5.png'),
('eyebrow_focused','Soustředěné','eyebrow','common','both','default',true,true,0,0,1,6,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_6.png'),
('eyebrow_unibrow','Srostlé','eyebrow','common','both','default',true,true,0,0,1,7,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_7.png'),
('eyebrow_oneraised','Jedno zvednuté','eyebrow','common','both','default',true,true,0,0,1,8,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_8.png'),
('eyebrow_sad','Smutné','eyebrow','common','both','default',true,true,0,0,1,9,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_9.png'),
('eyebrow_arched','Klenuté','eyebrow','common','both','default',true,true,0,0,1,10,'https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyebrow_10.png');
