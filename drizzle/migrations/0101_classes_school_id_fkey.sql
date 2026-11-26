ALTER TABLE public.classes
  ADD CONSTRAINT classes_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;