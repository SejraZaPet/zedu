# Popis hodiny (lesson_topics.note)

Migrace provedena 6. 11. 2026: sloupec `note text` + `lesson_topics_note_len` (max 1000 znaků). RLS beze změny.

Rollback (NESPOUŠTĚT bez pokynu):
```sql
ALTER TABLE public.lesson_topics DROP CONSTRAINT IF EXISTS lesson_topics_note_len;
ALTER TABLE public.lesson_topics DROP COLUMN IF EXISTS note;
```
