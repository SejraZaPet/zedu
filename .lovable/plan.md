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
