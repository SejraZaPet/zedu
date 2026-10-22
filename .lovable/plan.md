# Bannery – etapa 1 (databáze) – stav a rollback

Provedeno: migrace 0069 (tabulka `banners`, index, GRANT, RLS, demo RESTRICTIVE pravidla, trigger `tg_banners_guard`, `get_my_banners()`, storage pravidla `banners_obj_insert/delete`).
NEprovedeno: bucket `banners` – zakázán nastavením pracovního prostoru (veřejné buckety blokovány). Čeká na rozhodnutí.
Etapy 2 a 3 čekají na zvláštní schválení.

## Rollback (NESPOUŠTĚT bez souhlasu)
```sql
DROP POLICY IF EXISTS banners_obj_insert ON storage.objects;
DROP POLICY IF EXISTS banners_obj_delete ON storage.objects;
DROP FUNCTION IF EXISTS public.get_my_banners();
DROP TRIGGER IF EXISTS banners_guard ON public.banners;
DROP FUNCTION IF EXISTS public.tg_banners_guard();
DROP TABLE IF EXISTS public.banners;
-- bucket `banners` (pokud vznikne) smazat až po vyprázdnění: delete from storage.buckets where id='banners';
```
