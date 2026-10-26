# Bannery – etapa 1 dokončena: bucket `banners`

Stav: bucket `banners` založen 26. 10. 2026 (public = true, file_size_limit = 3145728 B). Politiky na storage.objects (`banners_obj_insert`, `banners_obj_delete`) pocházejí z migrace 0069 a byly ověřeny čtením – beze změny.

## Poznámka k MIME typům
Nástroj pro zakládání bucketů neumí nastavit `allowed_mime_types` a SQL zápis do `storage.buckets` je zakázaný. Sloupec proto zůstává prázdný (bez omezení na straně úložiště). Kontrolu typů (JPG/PNG/WebP/MP4, max 3 MB, rozměry, délka videa) provádí aplikace v `src/lib/banner-upload.ts`. Pokud je vyžadováno omezení i na straně úložiště, je potřeba samostatné schválení.

## Rollback (jen po schválení)
1. Vyprázdnit bucket `banners` (smazat všechny soubory `platform/…` a `school/…/…`).
2. Smazat bucket:
```sql
delete from storage.buckets where id = 'banners';
```
3. Politiky `banners_obj_insert` / `banners_obj_delete` na storage.objects ponechat (bez bucketu jsou neškodné) nebo odstranit spolu s rollbackem migrace 0069 dle původního plánu.
4. Tabulku `banners` ani funkce z migrace 0069 tímto krokem nemažeme – to je rollback celé etapy 1.
