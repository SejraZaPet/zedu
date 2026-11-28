# Vstup souborů – diagnostika 28. 11. 2026 a inventář nahrávání

Pouze čtení a analýza. Kód, databáze, RLS ani AGENTS.md nezměněny. Žádné obsahy fotek ani přepisů.

## Část A – diagnostika

### A1. Logy (28. 11. 2026, 07:00–14:00 UTC)
- **Logy HTTP volání funkcí nejsou pro okno přednášky dostupné.** Nejstarší uchovaný záznam je z 13:13 UTC (jen plánované úlohy, vše 200). Počty podle statusu (200/400/422/429/5xx) ani kódy UNREADABLE_PHOTO / INSUFFICIENT_TEXT proto nelze z logů zjistit.
- **AI Gateway (ověřeno):** v okně 48 požadavků, **všech 48 úspěšných (HTTP 200)**, žádné 402/429/5xx (44× gemini-3.8-flash, 4× flash-lite).
- **Demo využití AI (`demo_ai_usage`, ověřeno):** 42 rezervací v okně, všechny od demo účtů **bez štítku akce** (ne `dalkove-ucitele`):
  - `process-file-content` (soubor → lekce/obsah): 35 volání, 12 účtů, převážně 09:00–10:00 UTC;
  - `extract-practice-photo-text` (fotka → text): 2 volání, 1 účet (11 h UTC);
  - ostatní (classify-images, generate-activity-content, export-session-report, suggest-lesson-from-methods): po 1–2.
- Ostré (nedemo) účty se do `demo_ai_usage` nezapisují; jejich podíl je jen rozdíl 48 Gateway vs. demo volání (neověřitelné přesně, jedno volání funkce může dělat víc AI požadavků).

### A2. Kdy aplikace hlásí „nečitelné“ (z kódu)
`extract-practice-photo-text/core.ts`:
- 400: tělo není `{imageBase64, mimeType:"image/jpeg"}`, neplatné base64, > 4 MiB po dekódování.
- **422 UNREADABLE_PHOTO:** model nevrátil tool_call, argumenty nejsou platný JSON, chybí `text`, text je prázdný **nebo delší než 12 000 znaků** (dlouhý přepis = „nečitelné“, ne „příliš dlouhé“). `max_tokens: 4000`, bez kontroly `finish_reason` → useknutý výstup se jeví jako nečitelný.
- 422 INSUFFICIENT_TEXT: < 150 znaků.
- 402/429/403/400 z Gateway se mapují samostatně; ostatní chyby 502.
- Klient (`use-practice-photos.ts`, `source-extract.ts`): u odpovědi 422 čte `practiceErrorMessage`, který bere jen `body.error`; může se tak ukázat doslovný kód `UNREADABLE_PHOTO` místo přátelské hlášky (hypotéza z kódu).
- Převod v klientu (`practice-photo.ts`): JPEG/PNG/WebP/HEIC/HEIF, vstup ≤ 15 MiB, dekódování přes prohlížeč, zmenšení na 2048 px, JPEG 0,85, výstup ≤ 4 MiB. **Bez vlastního HEIC dekodéru**; dekódování v plném rozlišení před zmenšením (riziko paměti na telefonu).
- `process-file-content` (soubor do lekce): limit 25 MiB, max_tokens 16 000, bez striktního seznamu MIME; při selhání hláška „AI nedokázala přečíst dokument…“. Upstream 402/429 se ve větvi souboru mění na obecnou chybu → klient dostane 500.
- **Ověřená chyba v kódu:** `src/lib/office-extract.ts` – funkce `bytes()` volá sama sebe místo `file.arrayBuffer()` → nekonečná rekurze. Lokální čtení DOCX/PPTX/XLSX/ODT/ODP ve sdíleném vstupu (SourceInput) proto pravděpodobně vždy selže („Soubor se nepodařilo otevřít…“ nebo chyba zásobníku). Neověřeno v prohlížeči.

**Demo vs. ostrý účet:** rozdíl je jen v `demoAiGuard` (demo: limit na účet 25 a denní 1 500 z `demo_config`, u akce `dalkove-ucitele` 15/1 000) a v úložišti (`demo_storage_upload_ok`: přípony png/jpg/webp/pdf/docx/pptx/xlsx/xls/csv, 2 MB, 20 souborů; u akce 5 MB/50). Ostrý účet tyto kontroly nemá. Samotné čtení fotky je stejné.

**Nejpravděpodobnější příčina u účastníků na telefonech (hypotéza, logy chybí):**
1. Fotka z telefonu, kterou model přečetl, ale výstup neprošel kontrolou (hustá stránka → přes 12 000 znaků nebo useknutí na 4 000 tokenech; nebo bez tool_call). Gateway to vidí jako úspěch (200), aplikace jako „nečitelné“ – **sedí s tím, že všech 48 AI volání bylo 200**.
2. Rozmazaná/šikmá fotka → model vrátí prázdný text.
3. Pokud šlo o Word/PowerPoint přes sdílený vstup: chyba `office-extract.ts` (ověřená v kódu).
4. Méně pravděpodobné: HEIC v prohlížeči bez podpory (jiná hláška), velikost (jiná hláška).
Učitelka na demu mohla mít jednodušší/kratší stránku nebo jiný formát.

### A3. Limity AI (ověřeno)
- Žádný účet nenarazil: nejvyšší celkový počet AI volání na demo účet = 10 (limit 25), denní součet 42 (limit 1 500). Gateway bez 402/429. **Limity AI ani kredity příčinou nebyly.**

## Část B – inventář nahrávání

Zkratky: U = učitel, Ž = žák, A = admin/vedení školy. Dávka = více souborů / kombinace formátů. K/D/S = kamera / přetažení / vložení ze schránky.

### B1. Zdroje pro AI (převod na text)
| Funkce (kdo), soubor | Formáty (accept → server) | Dávka | K/D/S | Limity | Úložiště / zpracování | Sdílený vstup |
|---|---|---|---|---|---|---|
| Sdílený vstup zdrojů (U), `components/sources/SourceInput.tsx` | PDF, DOCX, DOC, PPTX, XLSX, ODT, ODP, TXT, MD; fotky image/*, HEIC | ano / ano | ano/ne/ne | 10 zdrojů, 4 dok., 6 fotek; dok. 20 MB, fotky 15 MB; 20 000 znaků | nic neukládá; lokální čtení + OCR po fotkách | ano (Studio, prezentace, pracovní list, z lekce) |
| Učím se / procvičování (Ž), `practice/PracticeSourceEditor.tsx` | 1× PDF/TXT; fotky image/* | fotky ano, dok. ne | ano/ne/ne | 6 fotek | OCR po fotkách s kontrolou | jen fotky (`usePracticePhotos`) |
| Z materiálu (U, Ž), `from-material/FromMaterialView.tsx` | image/* (bez převodu na JPEG); PDF/DOCX/PPTX | fotky ano; fotky × dokument se vylučují | ano/ne/ne | 6 fotek, text 20 000 | `process-file-content` + `generate-content-from-material` | ne |
| Průvodce aktivitou (U), `activities/ActivityWizardDialog.tsx` | PDF, DOCX, DOC, PPTX, image/* | ne | ne/ne/ne | bez klientského limitu | `process-file-content` | ne |
| Návrh podle metod (U), `pages/TeacherSuggestByMethod.tsx` | PDF, DOCX, PPTX | ne | ne | 20 000 znaků | `process-file-content` | ne |
| Import učebnice ze souboru (A/U), `admin/ImportTextbookFileDialog.tsx` | PDF, DOCX, PPTX, JPG, PNG, WebP (bez HEIC) | ne | ne | 25 MB | `process-file-content`; obrázky `lesson-images` | ne |
| Import PPTX/PDF do prezentace (U), `admin/ImportPptxToPresentationDialog.tsx` | PPTX, PDF | ne | ne | 60 MB, 50 stran, obrázky 10/60 MB | v klientu; `lesson-images` | ne |
| ŠVP – AI import (U), `pages/TeacherCurriculumPlans.tsx` | PDF, DOC, DOCX | ne | ne | 20 000 znaků | `parse-curriculum-document` | ne |
| Import uživatelů (A), `admin/UsersManager.tsx`, `school/SchoolBulkImportCard.tsx` | CSV, XLSX, XLS (XLS se reálně neparsuje) | ne | ne | – | lokální parsování | ne |

### B2. Přílohy a práce
| Funkce (kdo), soubor | Formáty | Dávka | K/D/S | Limity | Úložiště |
|---|---|---|---|---|---|
| Moje média (U), `media/MediaUploadZone.tsx` | JPG, PNG, GIF, WebP, PDF, MP3, MP4 | ano/ano | ne/ano/ne | 10 MB | `teacher-media` |
| Materiály úkolu (U), `assignments/AssignmentMaterialsEditor.tsx` | bez omezení | ano/ano | ne | 20 MB, video 100 MB | `assignment-materials` |
| Odevzdání úkolu (Ž), `assignments/AttachmentsUploader.tsx` | PDF, JPG, PNG, DOCX, XLSX, XLS, CSV | ano/ano | ne/ano/ne | 10 MB | `assignment-uploads` |
| Zprávy (U/Ž), `pages/MessagesPage.tsx` | PDF, JPG, PNG | ne | ne | 10 MB | `message-attachments` |
| Portfolio (Ž), `portfolio/AddPortfolioItemDialog.tsx` | bez omezení | ano/ano | ne | 20 MB | `student-portfolio` |
| Moje knížky (Ž), `pages/StudentBooks.tsx` | image/* | ne | ne | – | `student-portfolio` |
| Sešit (Ž), `notebook/NotebookCanvas.tsx` | image/* | ano/ano | ne | 10 MB | `notebook-media` |
| Akademie – doklady (U), `academy/AcademyView.tsx` | image/*, PDF, DOC, DOCX | ne | ne | – | `academy-evidence` |
| Příběhy třídy (U), `class-stories/ClassStoriesSection.tsx` | image/* | ne | ne | 8 MB | `lesson-images` |
| Živé koncepty (U), `live/LiveDraftsPanel.tsx` | image/* | ne | ne | – | `lesson-images` |
| ŠVP příloha (U/A), `TeacherCurriculumPlans`, `TeacherSubjectDetail`, `school/SchoolCurriculumManager.tsx` | PDF, DOC, DOCX | ne | ne | 20 MB | `curriculum-plans` |
| Školní zdroje (A), `school/SchoolResourcesManager.tsx` | image/* | ne | ne | – | `school-logos` |
| Branding školy (A), `school/SchoolBrandingSection.tsx` | PNG, JPEG, SVG, WebP | ne | ne | 1 MB | `school-logos` |
| Bannery (A), `banners/BannerManager.tsx` | JPEG/PNG/WebP, MP4 ≤ 10 s | ne | ne | 3 MB | `banners` |

### B3. Obrázky v editorech (vše `image/*`, bez převodu HEIC, úložiště `lesson-images`, není-li uvedeno jinak)
Obrázek lekce (LessonEditorSheet, TeacherTextbookLessonEditorSheet, TextbooksManager), ImageBlock, ImageTextBlock, GalleryBlock (dávka ano), ActivityBlock (popisky/hotspot), RichTextEditor, MarkdownImageToolbar (10 MB), BlockEditor (dávka, přetažení i schránka), WorksheetImageField (10 MB, přetažení i schránka, jen 1 soubor), ActivityEditor a FromSourceActivityPanel (10 MB přes worksheet-images), avatary (AvatarItemsManager, BulkUploadDialog – `avatar-assets`), pozadí her, landing, podcast.

### Shrnutí
**(1) Matice formát × funkce (hlavní mezery)**
| Formát | SourceInput | Učím se | Z materiálu | Import učebnice | Průvodce aktivitou | Odevzdání úkolu | Zprávy |
|---|---|---|---|---|---|---|---|
| PDF | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| DOCX/PPTX | ✓ (ale chyba office-extract) | ✗ | ✓ | ✓ | ✓ | DOCX ✓ | ✗ |
| XLSX | ✓ (chyba office-extract) | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| TXT | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| JPG/PNG | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HEIC | ✓ (jen s podporou prohlížeče) | ✓ (dtto) | surově, bez převodu | ✗ | surově | ✗ | ✗ |
| WebP | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Více fotek | ✓ 6 | ✓ 6 | ✓ 6 | ✗ | ✗ | ✓ | ✗ |
| Kamera | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

**(2) Samostatné implementace, které by měly používat společný vstup:** FromMaterialView, PracticeSourceEditor (dokumenty), ActivityWizardDialog, TeacherSuggestByMethod, ImportTextbookFileDialog, TeacherCurriculumPlans (AI import).

**(3) Rozpory:**
- Fotka z telefonu se v SourceInput/Učím se převádí na JPEG, v „Z materiálu“, průvodci a importu učebnice ne.
- DOCX/PPTX: v SourceInput lokálně (rozbité rekurzí), jinde serverem (funguje).
- Odevzdání úkolu bere XLS/CSV, zprávy ne; materiály úkolu a portfolio cokoli, ale demo úložiště jen vybrané přípony (GIF, SVG, MP3/MP4 v demu selžou).
- Import uživatelů nabízí XLS, ale čte jen XLSX.
- Dlouhá stránka v OCR = „nečitelné“ (12 000 znaků), jinde limit 20 000.
- 402/429 v `process-file-content` končí jako 500.
- `parse-curriculum-document` volá demo limit jen v catch.

**(4) Návrh jednotného řešení (neimplementováno)**
- Etapa 0 (nejmenší, frontend + 1 funkce): opravit `office-extract.ts` (`file.arrayBuffer()`); klient čte `body.message`/kód a ukazuje přátelskou hlášku; v OCR zvýšit max_tokens, kontrolovat `finish_reason` a > 12 000 znaků vracet jako „příliš dlouhé, rozdělte“ (nebo zkrátit s upozorněním); logovat kód chyby (bez obsahu).
- Etapa 1: `FromMaterialView`, ActivityWizard, TeacherSuggestByMethod, ImportTextbookFile → SourceInput / `prepareJpegPhoto`.
- Etapa 2: sdílený modul `_shared/file-policy.ts` (povolené typy, velikosti, počty) použitý ve všech funkcích + stejná konstanta v klientu; mapování 402/429 jednotně.
- Etapa 3: jedna komponenta pro přílohy (`FileDropInput`: dávka, přetažení, schránka, kamera, HEIC→JPEG, zmenšení před nahráním) pro úkoly, zprávy, portfolio, sešit, editory.
- Etapa 4: jedna demo rezervace AI za dávku fotek (z plánu jednotny-vstup-zdroju).
- Ke schválení (jen popis): sjednocení přípon v bucket politikách a `demo_storage_upload_ok` (SQL/RLS), případné nové MIME u bucketů (`assignment-uploads`, `message-attachments`), změna počítání demo AI za dávku (SQL funkce).
- Rizika: změna převodu obrázků ovlivní kvalitu tisku/PDF; sjednocení přípon může omylem povolit nebezpečné typy; nasazení funkcí jen po pokynu.

**Ověřeno vs. hypotéza:** ověřeno – nedostupnost logů, 48× AI 200, využití demo AI a nedosažení limitů, rekurze v `office-extract.ts`, podmínky v kódu OCR. Hypotéza – skutečná příčina hlášky u účastníků, chování HEIC na konkrétních telefonech, zobrazení doslovného kódu chyby.
