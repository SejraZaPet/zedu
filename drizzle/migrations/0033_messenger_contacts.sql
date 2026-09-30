CREATE OR REPLACE FUNCTION public.messenger_contacts()
RETURNS TABLE(id uuid, name text, is_teacher boolean, class_id uuid, class_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH my_classes AS (
    SELECT cm.class_id FROM public.class_members cm WHERE cm.user_id = auth.uid()
    UNION SELECT ct.class_id FROM public.class_teachers ct WHERE ct.user_id = auth.uid()
    UNION SELECT c.id FROM public.classes c WHERE c.created_by = auth.uid()
  ), people AS (
    SELECT cm.user_id AS uid, cm.class_id FROM public.class_members cm JOIN my_classes m ON m.class_id = cm.class_id
    UNION SELECT ct.user_id, ct.class_id FROM public.class_teachers ct JOIN my_classes m ON m.class_id = ct.class_id
    UNION SELECT c.created_by, c.id FROM public.classes c JOIN my_classes m ON m.class_id = c.id WHERE c.created_by IS NOT NULL
    UNION SELECT cp2.user_id, NULL::uuid FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
      WHERE cp1.user_id = auth.uid()
  )
  SELECT DISTINCT p.id, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),
    public.messenger_is_teacher(p.id), pe.class_id, c.name
  FROM people pe JOIN public.profiles p ON p.id = pe.uid
  LEFT JOIN public.classes c ON c.id = pe.class_id
  WHERE p.id <> auth.uid() AND auth.uid() IS NOT NULL
$$;
GRANT EXECUTE ON FUNCTION public.messenger_contacts() TO authenticated;