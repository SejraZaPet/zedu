# Učebnice: dlaždice, automatické obálky a banner

Pouze návrh. Nic se nenasazuje, žádné SQL se nespouští.

## Zjištěno v kódu a databázi
- Učitelské učebnice jsou v tabulce `teacher_textbooks`: název, předmět (`subject`, `subject_id`), popis, viditelnost a vlastník `teacher_id`. **Pole pro obrázek, obálku ani banner neexistuje.**
- Barvu má kanonická tabulka `subjects.color`, což je povinné pole. Starší tabulka `textbook_subjects.color` je nepovinná. Obálku lze tedy odvodit bez změny databáze.
- Seznamy jsou na stránkách `TeacherTextbooks.tsx`, `StudentTextbooks.tsx` a `TextbooksPage.tsx`. Detail žáka je `StudentTextbookDetail.tsx`.
- Úložiště: veřejný bucket `lesson-images` už existuje. Nahrávat do něj může každý učitel nebo admin, ale **nekontroluje se vlastnictví podle cesty**. Pro banner proto navrhuji nový bucket s přísnějšími pravidly.
- Postup žáka lze spočítat z existující tabulky `student_lesson_completions` a lekcí učebnice. Je potřeba jeden souhrnný dotaz pro celý seznam, ne jeden dotaz na každou kartu.

## Etapa 1: automatická obálka a banner (rozsah M)
1. **Automatická obálka (bez databáze, S):** nová funkce `textbook-cover.ts` stabilně vybere z hodnoty `subject_id`, případně z názvu, jeden přechod z palety Bezli. Použijí se stávající tokeny dlaždic. Ikonu předmětu vybere podle zkratky nebo názvu ze sady lucide, jinak použije `Book`. Barva předmětu slouží jen jako nápověda pro výběr nejbližšího přechodu z palety, aby nevznikaly libovolné barvy. Obálka je vykreslená přes CSS a SVG, nepoužívá obrázek. Bílý text musí mít kontrast aspoň 4,5:1, což ověří test. Žádná učebnice tak nezůstane bez obálky.
2. **Dlaždice v seznamu (S–M):** sdílená komponenta `TextbookCard` obsahuje obálku v poměru 4:3, název, předmět a postup, například „5 z 12 lekcí · 42 %“ s pruhem. Učitel u svých knih místo postupu vidí počet lekcí. Celá karta je odkaz s `aria-label` a viditelným focusem a ovládá se Enterem. Akční menu učitele zůstane samostatným tlačítkem, aby se karta nespouštěla dvakrát. Mřížka je `repeat(auto-fill, minmax(180px,1fr))`, na šířce 360 px má dva sloupce.
3. **Banner v detailu (vyžaduje SQL, M):** nahoře se zobrazí široký pás v poměru 16:5. Když banner chybí, zobrazí se velká verze automatické obálky. Přes obrázek je tmavý překryv, aby byl název čitelný. Banner může nahrát nebo smazat pouze vlastník učebnice, a to v nastavení učebnice. Zadává se také povinný alt text.

## Etapa 2: tvůrce obálky (rozsah M)
- Dialog „Upravit obálku“ nabídne 8 přednastavených přechodů z palety, výběr asi ze 40 ikon lucide, krátký podtitul do 40 znaků a volitelně vlastní obrázek s automatickým překryvem. Nabízí také „Obnovit automatickou“.
- Výběr se ukládá do `cover_style` jako JSON, například `{gradient:"g3", icon:"flask", subtitle:"..."}`. Neznámé hodnoty se při čtení vrátí na automatickou obálku, takže vizuální chaos nejde uložit.
- Náhled se zobrazuje živě v telefonní i počítačové velikosti.

## Návrh SQL (jen popis, nespouštět)
```sql
ALTER TABLE public.teacher_textbooks
  ADD COLUMN banner_image_url text,
  ADD COLUMN banner_alt text,
  ADD COLUMN cover_style jsonb;           -- etapa 2
-- Stávající pravidla úprav vlastníka (teacher_id = auth.uid()) se použijí i pro nová pole.
-- Demo pravidla demo_guard_* a demo_iso zůstávají beze změny.
```
- Bucket `textbook-banners` se vytvoří nástrojem, ne přes SQL. Bude veřejný pro čtení, aby obrázek viděli i žáci, a bude mít limit 2 MB.
- Pravidla pro `storage.objects`: vkládat, měnit a mazat může jen uživatel, kterému patří složka `{auth.uid()}/{textbook_id}/...`, a zároveň musí vlastnit danou učebnici. Ověření proběhne přes funkci `owns_teacher_textbook(id)` se SECURITY DEFINER. Demo uživatelé zůstávají omezení stávající funkcí `demo_storage_upload_ok`.

## Rizika
- **Velikost obrázků:** obrázek se před nahráním zmenší v prohlížeči na nejvýše 1920×600 a převede na WebP nebo JPEG s kvalitou 0,82. Limit bucketu je 2 MB.
- **Alt text:** povinné pole. Když chybí, použije se „Banner učebnice {název}“. Automatická obálka je dekorativní, proto má `aria-hidden` a název je v textu karty.
- **Kontrast:** přechodový překryv od 0 % do 70 % zajistí, že bílý text projde i přes světlé fotky.
- **Mobil:** na telefonu se banner ořízne na poměr 16:7 přes `object-fit: cover`. Dlaždice nesmí způsobit vodorovný posun. Animace najetí se při reduced motion vypnou.
- **Výkon:** postup se načte jedním dotazem pro celý seznam a obrázky se načítají líně.
- **Systémové a demo knihy:** jen pro čtení, bez nahrávání. Zobrazí automatickou obálku.

## Soubory
- Nové: `src/lib/textbook-cover.ts` s testem, `src/components/textbooks/TextbookCover.tsx`, `TextbookCard.tsx`, `TextbookBanner.tsx`. V etapě 1b `TextbookBannerUpload.tsx`, v etapě 2 `CoverDesignerDialog.tsx`.
- Upravené: `TeacherTextbooks.tsx`, `StudentTextbooks.tsx`, `TextbooksPage.tsx`, `StudentTextbookDetail.tsx`, učitelský detail nebo nastavení učebnice a `src/index.css` s tokeny.

## Pořadí a rozdělení do promptů
1. **Prompt 1 (bez databáze):** automatická obálka, karty a postup v seznamech, banner zatím jen jako velká automatická obálka. To lze zadat jedním promptem.
2. **Prompt 2 (po schválení SQL):** pole `banner_*`, bucket, pravidla přístupu, nahrávání s kompresí a alt textem.
3. **Prompt 3:** tvůrce obálky a pole `cover_style`.

## Otázky pro Tynu
1. Obálka v poměru 4:3 (mírně obdélníková)? (ano/ne)
2. Má učitel u svých knih vidět místo postupu počet lekcí? (ano/ne)
3. Má být alt text banneru povinný? (ano/ne)
4. Banner jen u učitelských učebnic, systémové knihy jen s automatickou obálkou? (ano/ne)
