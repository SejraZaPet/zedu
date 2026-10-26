# Bannery pro zástupce vedení (get_my_banners) – návrh ke schválení

## Zjištěný stav (ověřeno čtením databáze)
- `school_leadership_delegates`: `id`, `school_id` (NOT NULL, FK schools ON DELETE CASCADE), `user_id` (NOT NULL), `granted_by`, `created_at`; UNIQUE (school_id, user_id). Sloupce platnosti ani stavu neexistují – odebrání zástupce = smazání řádku.
- RLS: SELECT pro členy školy / školního admina, INSERT a DELETE jen `is_school_admin_of(school_id, auth.uid())`. Žádný UPDATE.
- Existující funkce `public.is_school_leadership(_school_id, _user_id)` (SECURITY DEFINER, STABLE) = `is_school_admin_of(...)` OR řádek v delegates pro tu školu. Použije se.
- `get_my_banners()`: EXECUTE mají `authenticated` a `service_role`, `anon` ne. Toto se nemění (CREATE OR REPLACE zachová práva).
- Data: 2 zástupci, 0 bannerů s `target_leadership = true` → dnes bez viditelného dopadu.

## Jediná změna
V CTE `me` se příznak `lead` změní z „má roli school_admin“ na „má roli school_admin NEBO je vedením své školy podle profilu“. Vše ostatní (filtry, střídání platformních/školních, řazení, LIMIT 6, SECURITY DEFINER, search_path, návratový typ) zůstává doslova stejné.

## Migrace (SQL)
```sql
CREATE OR REPLACE FUNCTION public.get_my_banners()
 RETURNS SETOF banners
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT public.get_user_school_id(auth.uid()) AS school_id,
      (EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='school_admin')
        OR COALESCE(public.is_school_leadership(public.get_user_school_id(auth.uid()), auth.uid()), false)) AS lead,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('teacher','lektor')) AS teach,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='user') AS stud
  ), live AS (
    SELECT b.*, row_number() OVER (PARTITION BY b.scope ORDER BY b.sort_order, b.created_at) rn
    FROM banners b, me
    WHERE auth.uid() IS NOT NULL AND b.is_active AND NOT b.hidden_by_admin
      AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at > now())
      AND (b.scope='platform' OR b.school_id = me.school_id)
      AND ((me.lead AND b.target_leadership) OR (me.teach AND b.target_teachers) OR (me.stud AND b.target_students))
  )
  SELECT id, scope, school_id, media_type, image_path, video_path, poster_path, alt_text, link_url,
         target_students, target_teachers, target_leadership, display_seconds, starts_at, ends_at,
         sort_order, is_active, hidden_by_admin, created_by, created_at, updated_at
  FROM live ORDER BY rn, (scope='school') LIMIT 6
$function$;
```

## Rollback (původní definice doslova)
```sql
CREATE OR REPLACE FUNCTION public.get_my_banners()
 RETURNS SETOF banners
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT public.get_user_school_id(auth.uid()) AS school_id,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='school_admin') AS lead,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('teacher','lektor')) AS teach,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='user') AS stud
  ), live AS (
    SELECT b.*, row_number() OVER (PARTITION BY b.scope ORDER BY b.sort_order, b.created_at) rn
    FROM banners b, me
    WHERE auth.uid() IS NOT NULL AND b.is_active AND NOT b.hidden_by_admin
      AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at > now())
      AND (b.scope='platform' OR b.school_id = me.school_id)
      AND ((me.lead AND b.target_leadership) OR (me.teach AND b.target_teachers) OR (me.stud AND b.target_students))
  )
  SELECT id, scope, school_id, media_type, image_path, video_path, poster_path, alt_text, link_url,
         target_students, target_teachers, target_leadership, display_seconds, starts_at, ends_at,
         sort_order, is_active, hidden_by_admin, created_by, created_at, updated_at
  FROM live ORDER BY rn, (scope='school') LIMIT 6
$function$;
```

## Bezpečnost
- **Cizí škola:** příznak se počítá jen pro školu z profilu uživatele (`get_user_school_id`). Zástupce jiné školy, než má v profilu, vedení nezíská. Školní bannery cizí školy filtr `b.school_id = me.school_id` dál vylučuje.
- **Vedení jiné školy:** školní banner pro vedení vidí jen při shodě školy. Platformní banner pro vedení (scope='platform') uvidí každý zástupce, stejně jako dnes každý school_admin; to je záměr platformního cílení.
- **Bez profilu/školy:** `school_id` NULL → `is_school_leadership` vrátí false → jen běžné bannery podle role.
- **Odebraný zástupce:** smazáním řádku přestane být vedením okamžitě (funkce je STABLE, bez cache). Platnost/stav v tabulce nejsou, není co obejít.
- **Zápis:** RLS na `banners`, storage politiky, demo politiky ani `BannerManager` se nemění; správu dál vidí jen school_admin. Funkce jen čte.
- **Demo:** demo účty nemají řádky v delegates; chování beze změny.

## Test (po schválení, v transakci s ROLLBACK, data označená [TEST])
V jedné transakci: založit [TEST] školy A a B, [TEST] uživatele-učitele s profilem ve škole A a řádkem v delegates pro A, a bannery: školní A pro vedení, školní B pro vedení, platformní pro vedení, školní A jen pro žáky. Nastavit `request.jwt.claims` na tohoto uživatele a ověřit výsledek `get_my_banners()`: vidí A-vedení a platformní-vedení, nevidí B-vedení ani žákovský. Pak smazat řádek delegates a ověřit, že bannery pro vedení zmizí. Vše končí ROLLBACK, nic nezůstane. Spustit lze jen nástrojem, který povolí zápis v transakci; pokud to nepůjde, ověření proběhne dotazem s reálnými (beze změny) daty a popisem výsledku.

## Dopad
- Stávající uživatelé: školní admini, učitelé a žáci dostanou totožný výsledek. Zástupci (2) navíc uvidí bannery pro vedení – dnes žádný takový banner neexistuje, takže okamžitý dopad je nulový.
- Kód aplikace, RLS, tabulky, edge funkce ani úložiště se nemění. Je to jediná změna.

---

# Část B: Klíč odpovědí přímo u otázek (učitelská verze) – návrh

## 1. Jak renderer dnes zná odpověď
- Typy položek (`src/lib/worksheet-spec.ts:16–47`): mcq, fill_blank, true_false, matching, ordering, short_answer, open_answer, offline_activity, section_header, write_lines, instruction_box, two_boxes, qr_link, flow_steps, crossword, word_search, sorting, flashcards, image_label, image_hotspot, lesson_reference, table, image, image_text, gallery, callout, blank_box.
- Otázka (`WorksheetItem`, 147–281) nese jen zadání a podklady (`choices`, `blankText` s `___`, `matchPairs`, `orderItems`, `tableRows`/`tableEditable`, `points`). Správná odpověď v ní není.
- Odpovědi jsou zvlášť v `spec.answerKeys[variantId]` jako `AnswerKeyEntry { itemId, itemNumber, correctAnswer: string | string[], explanation?, rubric? }` (284–293). Ukládají se do `worksheets.spec` a varianty je kopírují (906–920, 994–998).
- Formát odpovědi není podle typu vynucený:
  - mcq: text možnosti nebo písmeno, např. „B“ / „B)“ – `mcqKeyAnswer`, `worksheet-print-renderer.ts:1411–1423`,
  - pravda/nepravda: „true“ / „Pravda“ / „Nepravda“,
  - doplňování: pole slov v pořadí mezer,
  - přiřazování: pole „levá=pravá“ nebo „levá → pravá“,
  - řazení: pole textů v pořadí,
  - otevřená: text a `rubric`.
  Výchozí hodnoty jsou v `worksheet-defaults.ts:234–257`, příklady v `worksheet-spec.ts:729–746`.
- Vykreslování: `renderItem` (`worksheet-print-renderer.ts:962–1378`), klíč `renderAnswerKey` (1380–1408, bez rubriky), blok učitele `renderTeacherBlock` (1507–1516). Volby `WorksheetPrintOptions` (1453–1462) obsahují `teacherVersion`. Klíč se zapíná přes `spec.renderConfig.includeAnswerKey` a u učitele je vždy zapnutý (1547–1552).

## 2. Nejmenší změna (jen kód, bez databáze)
- Nová volba rendereru `answerKeyPlacement?: "inline" | "end" | "both"`. Když chybí, chování je stejné jako dnes („end“), takže stávající volání (náhled v editoru, `renderAllVariants`, sešit, testy) se nezmění.
- Odpovědi u otázek se vykreslí **jen** při `teacherVersion === true` a placement `inline`/`both`. `renderItem` dostane volitelný záznam klíče (mapa podle `itemId`); bez učitelské verze se mapa vůbec nepředá.
- Vzhled (rozlišitelný i v černobílém tisku: tučné písmo, symbol, rámeček; barva je jen doplněk):
  - mcq: správná možnost ☒ + tučně + odstín zelené; párování textu i písmene stejně jako `mcqKeyAnswer`,
  - pravda/nepravda: správná hodnota ☒ + tučně,
  - doplňování: slovo vepsané do čáry tučně a podtrženě,
  - krátká/otevřená: rámeček „Vzorová odpověď“ s textem a rubrikou, s body,
  - řazení: čísla pořadí vepsaná do políček,
  - přiřazování: seznam správných dvojic „levá → pravá“ pod položkou,
  - tabulka: vyplní se upravitelné buňky, jen pokud klíč obsahuje pole pro buňky; jinak text pod tabulkou,
  - ostatní typy (sorting, crossword, image_label…): obecný řádek „Odpověď: …“ pod položkou, pokud záznam existuje.
- Vysvětlení se zobrazí malým šedým písmem pod otázkou. Body zůstávají vpravo jako dnes.
- Neplatná nebo neznámá podoba odpovědi se zobrazí jako obecný řádek „Odpověď: …“. Nic nespadne a nic se nezahodí.

## 3. Volba v dialogu Export PDF
- `WorksheetEditor.tsx`: nový stav `pdfKeyPlacement` (výchozí `inline`) vedle `pdfIncludeAnswerKey` (415) a `pdfVersion` (416). U učitelské verze (dialog 2800–2875, volby verze 2823–2849) se zobrazí přepínač „Klíč odpovědí: ● přímo u otázek / ○ na konci listu / ○ obojí“.
- `PdfExportOptions` (`worksheet-pdf-export.ts:19–32`) dostane `answerKeyPlacement?`. `buildPrintHtml` (37–78) ho předá rendereru. Stahování (editor 1071–1074) i náhled (1122–1125) pošlou stejnou hodnotu, takže Náhled, tisk a PDF jsou stejné.
- Při volbě „přímo u otázek“ se klíč na konci nevykreslí. Blok poznámek učitele zůstane na konci stránky jako dnes. Žákovská verze přepínač nemá a zůstává beze změny.

## 4. Dopad na rozvržení
- Odpověď je uvnitř `.ws-item`, který už má `break-inside: avoid` (330–333). Stránkování (`worksheet-pdf-export.ts:97–120`) měří hotové bloky, takže položky jen o něco narostou a dělení stránek zůstává správné. Klíč na konci se dělí dál po řádcích (123–145).
- Kompaktní mcq ve dvou sloupcích (956–975, 374–390) zůstává; jen se zvýrazní správná buňka a nic se nepřidává do mřížky.
- Zvláštní režim „PDF pro pero“ v kódu není. Žákovský tisk (`buildStudentWorksheetHtml`, 248–285) klíče maže a nemění se.
- Testy: `worksheet-teacher-key` se rozšíří. `print-density`, `table-row-height` a `student-worksheet-pdf` volají renderer bez nové volby, takže by měly projít beze změny.

## 5. Rizika a testy
- **Únik do žákovské verze:** nový test pro každý typ s odpovědí. Postaví list s jedinečnými značkami odpovědí a vysvětlení a ověří, že HTML z `buildStudentWorksheetHtml` a ze žákovského `renderWorksheetVariantHtml` neobsahuje značky, třídy `ws-inline-key`/`ws-key-*` ani je nemá v atributech `title`/`aria`/`data-*`. Statické hledání dnes žádné takové atributy nenašlo.
- **Pozor na existující možnost:** v editoru jde u žákovské verze ručně zapnout „Zahrnout klíč“ (2850–2861). To je dnešní chování a odpovědi u otázek tam nepřibudou.
- **Staré listy:** formáty odpovědí se liší (text/písmeno, „true“/„Pravda“, různé oddělovače dvojic). Pro každý formát bude test, u neznámého formátu se použije obecný řádek „Odpověď: …“.
- **Demo:** jde jen o vykreslení na straně prohlížeče, demo ochrany ani ukládání se nemění.
- **Další testy:** výchozí volba = u otázek; „na konci“ dává stejné HTML jako dnes; „obojí“ vykreslí obě části; volání bez parametru se nemění.
- **Migrace není potřeba:** data i oprávnění zůstávají stejné.

---

# Část C: Pracovní listy žáka v sešitě, úkolu a učebnici – průzkum a návrh

## A. Jak se list dostane k žákovi
| Cesta | Co vznikne | Kam se ukládá | Vidí učitel? |
|---|---|---|---|
| Úkol s digitálním listem | `StudentAssignmentPlayer.tsx:947-969` → `WorksheetPanel` → `WorksheetPlayer` | `assignment_attempts.answers` / `progress` (autosave každých 10 s, `useWorksheetAutosave.ts:138-151`, odevzdání `worksheet-attempt.ts:145-168`) | Ano: `WorksheetAttemptGrading` (`AssignmentDetailDialog.tsx:741-744`), hodnocení v `progress._teacher_grading` |
| Sešit → Vložit list „digitálně“ | 1 stránka `notebook_pages` s `content.worksheet` = {worksheetId, mode, assignmentId?} (`worksheet-notebook.ts:160-166`), zobrazí se živě (`NotebookWorksheetPage.tsx:20-44`) | odpovědi v `assignment_attempts` (s úkolem) nebo `student_worksheet_work` | jen s úkolem |
| Sešit → Vložit list „pro pero“ | Žádné PDF: HTML listu se v prohlížeči převede `html2canvas` (scale 1.4, JPEG 0.82) na obrázek každé A4 stránky (`worksheet-notebook.ts:100-124,169-190`), uloží do `notebook-media` | tahy `content.strokes`, text `.textBoxes` (`notebook.ts:49-61`), ukládání po 800 ms (`MyNotebook.tsx:204-219`) | jen jako snímek při odevzdání úkolu (`answers._notebookSnapshot`, `worksheet-notebook.ts:213-251`) |
| Učebnice (kapitola) | `LessonWorksheets.tsx:21-27` čte `worksheets.source_lesson_id` + `show_in_lesson`; otevře úkol, nebo samostatný list (`:60`) | `student_worksheet_work` | Ne (RLS jen vlastník, `0052_student_worksheet_work.sql:25-42`) |
| QR / odkaz z tisku | `/student/pracovni-list/:id` (`worksheet-pdf-export.ts:46`, `App.tsx:208`) → `StudentWorksheetView.tsx:29-72`; úkol nehledá | `student_worksheet_work` | Ne |
| Vyfocený tištěný list | obrázek do sešitu (`NotebookCanvas.tsx:440-445`) nebo příloha úkolu (`AttachmentsUploader.tsx:94-107`) | `notebook-media` / `assignment_attachments` | přílohu úkolu ano; bez rozpoznání odpovědí |

## B. Příčiny problémů 2–4
- **(i) „Prázdné“ stránky:** sešit nemá líné vykreslování (IntersectionObserver). Ikona dokumentu s názvem je **digitální stránka listu** (`NotebookWorksheetPage.tsx:3,20-24`), ne nevykreslené PDF. Pravděpodobně se list ve verzi „digitálně“ nenačte (chybí přístup k listu nebo úkolu, nebo jde o náhled stránky). Rastrové stránky mají při načítání kolečko a při chybě hlášku (`NotebookImageContent.tsx:83-100`). Velké stránky: plátno má max. 820 px (`NotebookCanvas.tsx:464-468`), takže obrovské stránky 1300×1900 jsou nejspíš seznam/náhled v `MyNotebook`. **Neověřeno, ověřím jako první krok etapy 1** (Chromium 1390×1900 na [TEST] sešitu).
- **(ii) Posunuté tahy:** přepočet souřadnic je jinak správný (čerstvý `getBoundingClientRect`, DPR, `touch-none`; `NotebookCanvas.tsx:76-136`). Skutečné chyby:
  1. Chybí hlídání aktivního prstu nebo pera a `pointercancel` (`:140-205,469-472`). Dlaň nebo druhý prst tak „převezme“ rozepsaný tah, a proto vznikají čáry k okraji a přes nadpis.
  2. Odmítání dlaně je jen časové, na 1 s po peru (`:122-136`).
  3. Souřadnice se počítají včetně rámečku, ale kreslí se bez něj (`:101-118`), což dává drobný posun u okrajů.
  4. Ťuknutí perem (jeden bod) se zahodí (`:211-217`).
  Do jiné stránky se tahy neukládají, ukládá se vždy do aktivní stránky (`MyNotebook.tsx:202,679`).
- **(iii) Psaní klávesnicí na listu „pro pero“:** nástroj Text „T“ existuje (`NotebookCanvas.tsx:154-168`). Nové pole se ale posune doleva a nahoru (omezení x ≤ 0,4, y ≤ 0,92) a začíná písmem 32, což je nepraktické. Obrázek nemá žádná pole, kam by šla odpověď napsat.

## C. Přehrávač na tabletu
- **„[0 body]“:** formátování u nulových bodů (`WorksheetPlayer.tsx:348`), štítky na řádcích 424 a 596. Sekce bez označení `section_heading` (394–398) dostanou štítek bodů.
- **„Vyplněno 2/6“:** do počtu se započítávají i sekce a bloky bez odpovědi (`:263,278`).
- **Velikost polí:** textová pole mají písmo `text-sm` (pod 16 px, `LayoutBlockItem.tsx:62,192`), což na iPadu způsobí přiblížení stránky při psaní. Otevřená odpověď má jen 5 řádků a omezenou šířku (`OpenAnswerItem.tsx:6-12`), buňka tabulky 1 řádek. Úprava pro klávesnici iPadu (`visualViewport`) chybí a lepkavá lišta (`:352`) zakrývá pole.
- **Tisk/PDF pro žáka:** tlačítka jsou jen na samostatném listu a v učebnici (`StudentWorksheetView.tsx:59-65`, `LessonWorksheets.tsx:65`). Obě dělají totéž. Návrh: nechat jedno „Vytisknout“, ve sbaleném menu.
- **Scribble (Apple Pencil):** běžná `textarea`/`input` Scribble podporuje, pokud se pole při psaní nepřekreslí. Na zařízení neověřeno.

## D. Návrh řešení – varianty
1. **Varianta 1 – opravy na místě:** stávající dva režimy, jen opravy pera, polí a velikostí. Je to nejméně riziková varianta, ale nesjednocuje to.
2. **Varianta 2 (doporučená) – jeden model „list v sešitě“:** vložení listu do sešitu vytvoří vždy **živou vyplnitelnou stránku** (stejné položky jako přehrávač). Nad ní je volitelná průhledná vrstva pro pero, uložená v `content.strokes` stejné stránky a zarovnaná na kontejner A4 listu. Přepínač v liště „Psát“ / „Pero“: v režimu Pero se kreslí jen perem (`pointerType==='pen'`) a prst posouvá stránku. `touch-action: none` platí jen v režimu Pero. Režim „pro pero“ zůstane jen pro cizí PDF a fotky (obrázek + vrstva + textová pole).
3. **Varianta 3 – plně rastrový list s rozpoznáním písma:** odpovědi by se ze snímku rozpoznávaly (OCR/AI). Je to drahé, nespolehlivé a citlivé na data. Nedoporučuji.
- **Velikost stránek:** šířka kontejneru, max. ~820 px, poměr A4, pruh miniatur, šipky mezi stránkami listu, „Vyplněno x/y“ v hlavičce stránky listu.
- **Učebnice ↔ sešit:** v kapitole tlačítko „Otevřít v sešitě“, které použije stávající `ensure_my_course_notebooks()` a vložení digitální stránky.
- **Zpětná vazba učiteli:**
  - list s úkolem jde dál přes `assignment_attempts` a `WorksheetAttemptGrading` (beze změny),
  - u listu bez úkolu vyžaduje viditelnost pro učitele změnu RLS nad `student_worksheet_work`. To je samostatná DB etapa, kterou předložím s SQL a rollbackem zvlášť; v tomto návrhu ji nespouštím.

## E. Etapy
1. **Rychlé opravy** (bez DB; viz F) + měření v Chromiu s emulací dotyku a pera.
2. **Přehrávač na tabletu:** písmo 16 px, větší pole, lišta se při psaní neposouvá přes pole (`visualViewport`), menu tisku. Bez DB.
3. **Sjednocený list v sešitě** (varianta 2): vrstva pera nad digitální stránkou, přepínač Psát/Pero, miniatury, průběh vyplnění. Bez DB, nové klíče jen v `notebook_pages.content`. Staré stránky „pro pero“ zůstanou funkční.
4. **Učebnice → sešit:** tlačítko „Otevřít v sešitě“. Bez DB.
5. **(Volitelně, vyžaduje DB a schválení)** učitel vidí samostatnou práci žáků (`student_worksheet_work`): SQL a rollback předložím zvlášť.
- **Rizika:**
  - stávající sešity a tahy se nepřepisují, nové pole se jen přidá,
  - výkon iPadu: jedno plátno na aktivní stránce, žádný `html2canvas` při každém zobrazení,
  - demo: zápis jde přes stávající RLS a demo politiky, beze změn.
- **Testy:**
  - jednotkové: souřadnice tahu s rámečkem, ignorování druhého pointeru, `pointercancel`, nulové body bez štítku, počet „Vyplněno“ bez sekcí,
  - Playwright: emulace iPadu (1390×1900, `hasTouch`) a syntetické pen/touch události.
- **Co nedělat:** neměnit úkoly, hodnocení ani bodování; nemazat ani nepřevádět stávající stránky; neměnit RLS bez zvláštního schválení; žádné OCR.

## F. Rychlé opravy (do ~1 h, bez DB)
1. **Pero:**
   - hlídat ID aktivního pointeru a `pointercancel` / `lostpointercapture`,
   - po prvním peru ignorovat dotyk po celou dobu tahu,
   - počítat souřadnice proti vnitřní ploše bez rámečku,
   - ťuknutí perem vykreslí tečku (`NotebookCanvas.tsx:113-217,469-472`).
2. **„[0 body]“:** skrýt štítek, když `points <= 0` (`WorksheetPlayer.tsx:348,424,596`).
3. **„Vyplněno x/y“:** počítat jen položky s odpovědí (`:263,278`).
4. **Psaní na iPadu:** písmo polí 16 px na dotykových zařízeních (`LayoutBlockItem.tsx:62,192`).
5. **Text na listu „pro pero“:** nové pole tam, kam se ťukne (bez posunu doleva), písmo 20 a tlačítko „Psát klávesnicí“ na stránce s listem (`NotebookCanvas.tsx:154-168`).
6. **Zmenšení stránek:** po změření opravit rozměr zobrazení v `MyNotebook` na max. ~820 px.
