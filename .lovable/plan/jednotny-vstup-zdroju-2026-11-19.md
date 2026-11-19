# Jednotný vstup zdrojů – analýza a návrh (19. 11. 2026)

Jen analýza a návrh. Kód, databáze, migrace ani nasazení se neměnily. Implementace začne až po schválení konkrétní etapy.

## A) Inventář

Ověřeno čtením kódu (soubor:řádek). Místa označená „neověřeno“ pocházejí ze zadání a ověří se v etapě 3.

| Místo | Kdo | Zdroje dnes | Limity | Kam text jde (model) | Demo guard | Ukládá zdroj |
|---|---|---|---|---|---|---|
| ActivityWizardDialog | učitel | lekce / text / 1 soubor | 6000 znaků, **tiché oříznutí** (activity-wizard.ts:8, 59, 89) | generate-activity-content (gemini-3-flash-preview, :170; server ořízne 6000, :150) | ano (:45) | ne |
| BlockEditor – AI z bloku | učitel/admin | text lekce | **tiché oříznutí slice(0,6000)** (BlockEditor.tsx:1569, 1598, 1905); LessonSourcePickerDialog 6000 | generate-activity-content | ano | ne |
| FromMaterialView („Z materiálu“) | učitel i žák | 6 fotek NEBO 1 dokument, bez pole pro text; soubor nahradí fotky a naopak | klient 20 000, **server tiše ořízne na 12 000** (generate-content-from-material:82, 178); fotky slice(0,6) (:87, 183) | process-file-content → generate-content-from-material (gemini-2.5-flash) | ano (:31) | ne (neověřeno do detailu) |
| StudentMethods („Učím se“) | žák | text / 1 PDF nebo TXT / až 6 fotek | 150–8000, bez ořezu, viditelné upozornění (practice-phases.ts:50) | extract-practice-photo-text + ai-practice-rag (gemini-2.5-flash) | ano | jen { kind } |
| TeacherSuggestByMethod | učitel | .pdf/.docx/.pptx, text lekce | **tiché oříznutí na 20 000** (:437, 467), server 12 000 | process-file-content + suggest-lesson-from-methods | ano | návrh ano |
| TeacherCurriculumPlans / curriculum-file-extract | učitel | dokument (extractDocumentText, :364) | 20 000 (curriculum-file-extract.ts:5) | process-file-content + AI plán | neověřeno | plán ano |
| ImportTextbookFileDialog | učitel/admin | dokument | neověřeno | process-file-content | **ne** | vytváří lekce (záměrně) |
| WorksheetEditor – z lekce | učitel | text lekce | 20 000 jako podmínka (:1769) | generování listu | neověřeno | ne |
| SchoolCurriculumManager, AcademyView, ZedAI, AttachmentsUploader | různé | neověřeno | neověřeno | neověřeno | neověřeno | přílohy ano (nejsou AI zdroj) |
| Webový odkaz | – | nikde v kódu | – | – | – | – |

**Edge funkce**
- process-file-content: requireAuth (:1246), demoAiGuard (:1253), 25 MB, gemini-2.5-flash (:598, 630), 3 pokusy. Do logu zapisuje až 400 znaků chybového těla AI (:569).
- parse-curriculum-document: **demoAiGuard jen v catch (:209)**, úspěšné volání limit dema obejde.
- generate-activity-content: zapisuje do logu **celý neparsovatelný výstup AI** (:203), který může citovat zdroj. Model gemini-3-flash-preview je preview.

**Hlavní nekonzistence**
- Limity se liší: 6000 / 8000 / 12 000 / 20 000 znaků.
- Na čtyřech místech se text tiše ořezává.
- Nový zdroj přepíše předchozí: průvodce aktivit i „Z materiálu“.
- Demo: parse-curriculum-document kontroluje limit až po chybě.
- Modely: všude gemini-2.5-flash (zastaralý), jen aktivity používají 3-flash-preview.

## B) Společný modul

- `src/lib/source-bundle.ts` – čisté funkce bez React:
  - typy položek,
  - sloučení textů,
  - kontrola limitů,
  - jednotné české hlášky.
  - Bude se dát testovat bez prohlížeče.
- `src/lib/source-extract.ts` – jedna cesta extrakce podle typu:
  - TXT: lokálně,
  - DOCX/PPTX/PDF s textem: process-file-content v režimu „jen text“,
  - foto: practice-photo.ts a extract-practice-photo-text,
  - URL: nová funkce fetch-source-url.
- `useSourceBundle` – převezme z use-practice-photos:
  - rušení starých dávek číslem dávky,
  - zámek busy,
  - pořadí, opakování a odebrání jedné položky,
  - uvolnění náhledů.
- `<SourceInput>` – dlaždice a seznam zdrojů. Zobrazuje se podle props `allowed`, `limits`, `audience` (učitel/žák/demo).

**Tvar položky**
```text
{ id, kind: text|pdf|docx|pptx|txt|photo|url, label, status: pending|loading|ready|error,
  text?, chars, error?, origin? (název souboru / host odkazu) }
```

**Sloučení:** jen připravené položky v zobrazeném pořadí. Každá dostane záhlaví `--- Zdroj 2: Fotka (strana 1) ---` a mezi položkami je prázdný řádek. Před generováním uživatel vidí výsledek a počet znaků.

## C) Jednotné limity (návrh)

| Limit | Hodnota | Důvod |
|---|---|---|
| Zdrojů celkem | 10 | Přehledný seznam na mobilu |
| Fotek | 6 | Shoda s dneškem; každá je 1 OCR volání |
| Souborů | 4 | Přiměřená doba extrakce |
| Velikost souboru | 20 MB dokument, 15 MB fotka (po zmenšení 4 MB) | Shoda s existujícími limity |
| Znaků na zdroj | 20 000 | Shoda s dnešní extrakcí |
| Znaků celkem do AI | 20 000 učitel, 8000 žák, 8000 demo | Flash modely zvládnou víc, ale cena i doba odpovědi rostou. Žákovské procvičování dnes 8000. |
| Minimum | 150 znaků | Shoda s Učím se |

**Při překročení**
- Nikdy tiše neořezat.
- Ukázat „Vešlo se 14 200 z 20 000 znaků, přebývá 3 400“.
- Generování zablokovat, dokud uživatel neodebere zdroj nebo nezkrátí text v náhledu.
- Serverové ořezy (12 000 a 6000) se sjednotí na stejnou hodnotu jako klient. Server pak nadlimitní text odmítne chybou 413, místo aby ho tiše zkrátil.

## D) Webový odkaz – fetch-source-url

- Přihlášení je povinné (requireAuth).
- Demo počítá 1 volání na odkaz, rate limit 20 odkazů/h na uživatele.
- Povolené jen http/https na portech 80 a 443. Zakázané jsou přihlašovací údaje v URL a IP literály privátních, lokálních, link-local a metadata rozsahů (IPv4 i IPv6).
- Proti DNS rebindingu: vlastní resolve, kontrola všech adres a připojení na ověřenou IP.
- Přesměrování ručně, max 3, každé znovu ověřit.
- Timeout 8 s, max 2 MB.
- Povolené typy obsahu: text/html, text/plain, application/pdf (PDF jde do stávající extrakce).
- Čitelný text se vytáhne bez AI: odstranit skripty, navigaci a patičky, vzít hlavní článek.
- Srozumitelné chyby:
  - „Stránka vyžaduje přihlášení“ (401/403, přihlašovací formulář),
  - „Stránka se načítá jen skriptem, zkopíruj text ručně“ (prázdný text),
  - „Odkaz se nepodařilo načíst“.
- U zdroje upozornění: „Použij jen obsah, který smíš ve výuce použít; uveď zdroj.“ Do výstupu se přidá origin.
- Ukládat jen odkaz, a to pouze u učitelského obsahu, který se sám ukládá. Text se neukládá a u žáků se neukládá nic. Do logů nic z obsahu, jen stav a doba.

## E) Soukromí a demo

- Žákovské zdroje se neukládají ani nelogují.
- Fotky jen v paměti prohlížeče, na server jdou jen jako přenos k OCR.
- Odstranit z logů těla AI odpovědí: process-file-content:569, generate-activity-content:182 a 203, ai-practice-rag:193.
- Demo dnes: limit 5 AI volání na účet a denní strop (demo_config).

**Návrh pro demo – „zdroje zdarma, generování se počítá“:**
- Extrakce textu z DOCX, PPTX, TXT a PDF s textovou vrstvou poběží bez AI (parsování), takže se nepočítá.
- OCR fotek a skenované PDF se počítají. Celá dávka OCR zabere dohromady jedno volání, ne jedno na fotku. Technicky jedna rezervace demo limitu pro dávku s krátkým tokenem, takže změna server funkce extract-practice-photo-text potřebuje schválení.
- Výsledek: jedno generování stojí 1–2 volání.
- Pro přednášku s 50 lidmi: limit na pár (účet), ne sdílený. Upozornění předem kolik volání zbývá.
- Denní strop zkontrolovat, zda stačí: 50 lidí × 5 = 250 volání.

## F) UX

- Čtyři dlaždice v mřížce 2×2 (na 390 px), jejich množina se může zúžit podle místa:
  - Vložit text,
  - Nahrát soubory (multiple),
  - Vyfotit / Z galerie (foťák zvlášť),
  - Vložit odkaz.
- Seznam zdrojů:
  - ikona typu, název, počet znaků, stav (načítá se / hotovo / chyba + Zkusit znovu),
  - šipky pro pořadí, Odebrat,
  - souhrnný ukazatel „14 200 / 20 000 znaků“.
- Přidání nikdy nic nenahradí.
- Přístupnost:
  - stav načítání přes aria-live,
  - tlačítka s popisky („Posunout zdroj 2 nahoru“),
  - po odebrání se fokus přesune na sousední položku,
  - celé ovládání klávesnicí.
- Hlášky: učitel vykání, žák tykání (UI_COPY).

## G) Etapy

1. **Sdílený modul + „Z materiálu“ + průvodce aktivit** (L). Bez DB.
   - Odstraní tiché ořezy a nahrazování.
   - Server zjednoduší limity na stejné číslo.
   - Riziko: změna serverového ořezu u generate-content-from-material. Testy: source-bundle unit, mobil 390, regrese from-material a activity-wizard.
2. **Demo a soukromí** (M).
   - demoAiGuard do process-file-content jen pro OCR/AI cestu,
   - odstranění logování obsahu,
   - dávková rezervace OCR.
   - Případný sloupec v demo_config jen po schválení SQL.
3. **Napojení dalších míst** (M): Učím se (převzít hook), TeacherSuggestByMethod, BlockEditor, plány, WorksheetEditor. Napřed doplnit neověřené řádky inventáře.
4. **Webový odkaz** (M). Nová edge funkce, testy SSRF (privátní IP, přesměrování, rebinding, velikost, typy).
5. **Zbytek a modely** (S): ImportTextbookFileDialog, SchoolCurriculumManager, AcademyView, ZedAI; sjednocení modelu po rozhodnutí.

## H) Dotčené testy (nerozbít)

- practice-photo.test, practice-photo-batch.test, student-practice-photo.test, practice-method.test, student-practice*.test
- supabase/functions/extract-practice-photo-text/index.test.ts
- multiple-image-uploads.test, multiple-upload-batches.test
- testy activity-wizard a from-material: dohledat v etapě 1
- known failing (nesouvisí): classroom-people-source, lesson-study-bar, „useAuth must be used“

## Otázky pro Tynu

1. Celkový limit: 20 000 pro učitele a 8000 pro žáka/demo – souhlas?
2. Demo: počítat celou dávku OCR jako jedno volání a extrakci dokumentů zdarma? Vyžaduje změnu serveru.
3. Odkaz u učitelského obsahu ukládat (jako citaci), nebo vůbec?
4. Smí žák vkládat odkazy, nebo jen učitel?
5. Model: sjednotit na novější Flash?
6. Pořadí etap: odkaz jako druhá etapa, nebo až po napojení všech míst?

## Neověřeno bez živého testu

- Skutečné AI odpovědi a doba zpracování velkých zdrojů.
- HEIC, galerie a foťák na skutečném iPhonu/Androidu.
- Chování konkrétních webů (JS-only, cookie lišty, paywall).
- Skenované PDF bez textové vrstvy.
- Hodnota denního demo stropu a ZDR u modelů.
- Řádky inventáře označené „neověřeno“.
