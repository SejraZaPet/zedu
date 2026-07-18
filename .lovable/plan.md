## Diagnóza

**Bucket `lesson-images` má na `storage.objects` pouze 4 policies:**

| CMD | Kdo | Podmínka |
|---|---|---|
| SELECT | public | `bucket_id='lesson-images'` (kdokoliv) |
| INSERT | public | `bucket_id='lesson-images' AND is_admin()` |
| UPDATE | public | `bucket_id='lesson-images' AND is_admin()` |
| DELETE | public | `bucket_id='lesson-images' AND is_admin()` |

**Žádný path pattern se nekontroluje** — policy zajímá jen `is_admin()`. Naše cesta `pdf-embedded/{timestamp}-{random}/image-N.jpg` tedy není problém tvarem, ale rolí.

**Root cause:** `ImportTextbookFileDialog` je používán i z `TeacherTextbooks.tsx` (řádek 637). Když ho spustí **učitel** (ne admin), `is_admin()` vrátí `false` → INSERT policy zamítne upload. Stejný problém by měl už dřív i upload page-renderů do `pdf-import/...` — pravděpodobně to učitelka narazila poprvé teď, když embedded extrakce začala fungovat a hodila víc uploadů.

**DOCX/PPTX cesta (edge function `process-file-content`):** běží pod service_role, ta RLS obchází. Bez rizika.

## Návrh opravy

Rozšířit INSERT/UPDATE/DELETE policies pro `lesson-images` tak, aby povolily i **učitele** (nejen adminy). Obrázky jsou stejně veřejné (SELECT je otevřený všem) a učitelé legitimně vytváří obsah lekcí — je nekonzistentní, že admin může nahrávat obrázky do lekcí, ale učitel ne, přestože oba lekce editují.

Migrace:

```sql
DROP POLICY "Admin can upload lesson images" ON storage.objects;
DROP POLICY "Admin can update lesson images" ON storage.objects;
DROP POLICY "Admin can delete lesson images" ON storage.objects;

CREATE POLICY "Admins and teachers can upload lesson images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-images' AND public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can update lesson images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-images' AND public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can delete lesson images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-images' AND public.is_admin_or_teacher());
```

`public.is_admin_or_teacher()` už existuje (v seznamu DB funkcí) — vrací true pro role `admin` i `teacher`.

**Cesty (`pdf-embedded/...`, `pdf-import/...`) v `ImportTextbookFileDialog.tsx` neupravuju** — policy path pattern neřeší, takže není důvod je měnit.

## Ověření po aplikaci

1. Učitelka znovu spustí import PDF s obrázky → upload projde, galerie se objeví v draftované lekci.
2. Debug flag `{ debug: true }` v `ImportTextbookFileDialog.tsx` může zůstat pro tento test, pak ho odstraníme.

Souhlasíš s touto migrací?