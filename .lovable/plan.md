# Popis hodiny (lesson_topics.note)

Migrace provedena 6. 11. 2026: sloupec `note text` + `lesson_topics_note_len` (max 1000 znaků). RLS beze změny.

Rollback (NESPOUŠTĚT bez pokynu):
```sql
ALTER TABLE public.lesson_topics DROP CONSTRAINT IF EXISTS lesson_topics_note_len;
ALTER TABLE public.lesson_topics DROP COLUMN IF EXISTS note;
```

# Zeď třídy – komentáře (provedeno 6. 11. 2026, migrace 0078_assignment_comments_wall)
## Rollback (NESPOUŠTĚT bez pokynu)
```sql
DROP TABLE IF EXISTS public.assignment_comments;
DROP FUNCTION IF EXISTS public.assignment_comments_before_insert();
DROP FUNCTION IF EXISTS public.assignment_comments_before_update();
DROP FUNCTION IF EXISTS public.can_moderate_assignment_comments(uuid, uuid);
DROP FUNCTION IF EXISTS public.assignment_comments_enabled(uuid);
DROP FUNCTION IF EXISTS public.is_parent_only(uuid);
```
