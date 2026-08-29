ALTER TABLE public.class_schedule_slots
ADD COLUMN room_resource_id uuid REFERENCES public.school_resources(id) ON DELETE SET NULL;