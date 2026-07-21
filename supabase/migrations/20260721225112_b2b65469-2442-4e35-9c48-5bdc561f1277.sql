
ALTER TABLE public.avatar_items DROP CONSTRAINT avatar_items_category_check;
ALTER TABLE public.avatar_items ADD CONSTRAINT avatar_items_category_check CHECK (category = ANY (ARRAY['base'::text,'hairstyle'::text,'hair_color'::text,'outfit'::text,'face_accessory'::text,'head_accessory'::text,'background'::text,'frame'::text,'effect'::text,'badge'::text,'title'::text,'skin_tone'::text,'eyes'::text]));

ALTER TABLE public.avatar_profiles ADD COLUMN IF NOT EXISTS eyes_id uuid REFERENCES public.avatar_items(id);

INSERT INTO public.avatar_items (slug, name, category, rarity, image_url, recommended_for_role, unlock_type, is_default, is_active, layer_offset_x, layer_offset_y, layer_scale, sort_order)
VALUES
 ('closedhappy','Zavřené šťastné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%201.png','both','default',true,true,0,0,1,1),
 ('halfclosed','Přivřené','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%202.png','both','default',true,true,0,0,1,2),
 ('normal','Základní','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%203.png','both','default',true,true,0,0,1,3),
 ('small','Malé','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%204.png','both','default',true,true,0,0,1,4),
 ('narrow','Úzké','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%205.png','both','default',true,true,0,0,1,5),
 ('round','Kulaté','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%206.png','both','default',true,true,0,0,1,6),
 ('wide','Široké','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%207.png','both','default',true,true,0,0,1,7),
 ('tilted','Nakloněné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%208.png','both','default',true,true,0,0,1,8),
 ('side_glance','Pohled do strany','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%209.png','both','default',true,true,0,0,1,9),
 ('soft','Jemné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2010.png','both','default',true,true,0,0,1,10),
 ('bright','Jasné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2011.png','both','default',true,true,0,0,1,11),
 ('gentle','Mírné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2012.png','both','default',true,true,0,0,1,12),
 ('dazed','Zmatené','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2013.png','both','default',true,true,0,0,1,13),
 ('flirtywink','Mrknutí','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2014.png','both','default',true,true,0,0,1,14),
 ('alert','Pozorné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2015.png','both','default',true,true,0,0,1,15),
 ('asymmetric','Asymetrické','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2016.png','both','default',true,true,0,0,1,16),
 ('playful','Hravé','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2017.png','both','default',true,true,0,0,1,17),
 ('tiny','Drobné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2018.png','both','default',true,true,0,0,1,18),
 ('focused','Soustředěné','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2019.png','both','default',true,true,0,0,1,19),
 ('curious','Zvědavé','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2020.png','both','default',true,true,0,0,1,20),
 ('longlashes','Dlouhé řasy','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2021.png','both','default',true,true,0,0,1,21),
 ('starstruck_soft','Jemné s řasami','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2022.png','both','default',true,true,0,0,1,22),
 ('tearful','Slza','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2023.png','both','default',true,true,0,0,1,23),
 ('bigtears','Velké slzy','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2024.png','both','default',true,true,0,0,1,24),
 ('hearteyes','Srdíčka','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2025.png','both','default',true,true,0,0,1,25),
 ('sparkleeyes','Hvězdičky','eyes','common','https://rnndtpfmkanxbckdbflm.supabase.co/storage/v1/object/public/avatar-assets/eyes%2026.png','both','default',true,true,0,0,1,26);
