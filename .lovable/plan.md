# Pracovní list a vlastní materiál – analýza (nic se nemění)

## 1. Jak dnes vzniká pracovní list s AI
- **Editor listu** `src/pages/WorksheetEditor.tsx` (a admin `src/components/admin/WorksheetPanel.tsx`, plán hodiny `src/lib/plan-suggested-activities.ts`) volá edge funkci **`generate-full-worksheet`**.
- Vstup: text vybrané lekce (`lessonContent`, kratší než 20 000 znaků vcelku, delší po blocích; funkce bere max. 30 000), tabulky a aktivity lekce (QR/převod), název, druh listu, zaměření, sekce, obtížnost, **„Vlastní zadání pro AI“** (`hint` = jen pokyn, ne podklad), případová studie z metody, nebo téma ŠVP / plán hodiny. Demo limit hlídá `demoAiGuard`.
- Admin generátor otázek `LessonWorksheetGenerator.tsx` → `generate-lesson-worksheet` (lekce do 8 000 znaků).

## 2. Lze vložit vlastní materiál do generování?
- **V editoru listu: ne.** Zdrojem je jen lekce, téma ŠVP nebo plán; pole „Vlastní zadání“ je pokyn, ne materiál.
- **Jinde ano:** stránka **„Z materiálu“** (`/ucitel/z-materialu`, `FromMaterialView.tsx` → `generate-content-from-material`) umí vytvořit pracovní list z vloženého textu, PDF/DOCX a fotek (text do 12 000 znaků, max. 6 obrázků). Studio má sdílený vstup **`SourceInput`** + `source-bundle.ts` (text, soubory, fotky, odkaz přes `fetch-source-url`; max. 10 zdrojů, 4 soubory po 20 MB, 6 fotek, 20 000 znaků celkem pro učitele).
- Tyna to tedy dnes může udělat přes „Z materiálu“, ale ne přímo v editoru listu a bez kombinace s lekcí.

## 3. Materiál k hotovému listu
- **Pro žáka ano, ručně:** položky listu umí obrázek (`image`, `image_text`, `gallery`, obrázek u otázky přes `WorksheetImageField`), text/rámeček (`callout`, `instruction_box`), odkaz/QR (`qr_link`), odkaz na lekci (`lesson_reference`), tabulku. **PDF jako příloha listu neexistuje** – lze jen přes úkol (materiály úkolu) nebo odkaz.
- **Jen pro AI při opravě:** samostatně ne. AI hodnocení (`suggest-grading-feedback`) dnes u úkolu načte propojenou lekci a materiály úkolu; u bodování položek listu (`worksheet_points`) bere zadání položky a odpověď, ne zvláštní podklad listu.

## 4. Návrh nejmenšího řešení (ke schválení)
- V panelu AI v editoru listu přidat přepínač **„Z lekce / Vlastní materiál / Obojí“** s existující komponentou `SourceInput` (vložit text, nahrát PDF/DOCX/fotku, odkaz). Text materiálu se pošle do `generate-full-worksheet` v existujícím poli `lessonContent` (označený „Materiál učitele“), lekce zůstane volitelná.
- **Sjednocení:** ano – jedna sdílená komponenta např. `LessonOrOwnSourcePicker` (výběr lekce z `teacher-source-lessons` + `SourceInput`, výstup = jeden text s limity `source-bundle.ts`). Použije ji editor listu i `CreateFromLessonDialog` (krok 4 u úkolů, pokud se schválí).
- Materiál se **nikam neukládá** (stejně jako dnes v Studiu); uloží se jen vygenerované položky. Volitelně později: uložit text materiálu do `spec.metadata` jako podklad pro AI opravu – bez DB, ale je to až další etapa.
- **Odhad:** sdílená komponenta + editor listu 1–1,5 dne; napojení v `CreateFromLessonDialog` +0,5 dne; testy (limity, sloučení textu, prázdný zdroj).
- **Rizika:** dlouhé PDF (ořez – ukazovat varování, ne tiše oříznout), skenované PDF bez textu (OCR přes fotky), osobní údaje žáků ve vloženém materiálu (upozornění v UI), autorská práva cizích materiálů, štítek AI u výsledku zůstává.
- **Demo:** beze změny – volá se stejná funkce s `demoAiGuard` a stávajícími limity; nic se neukládá navíc.
- **RLS/DB:** žádná změna; soubory se zpracují v prohlížeči/`fetch-source-url` bez úložiště.
