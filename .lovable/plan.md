# Postup pro učitele na přednášce (jen popis, žádná změna kódu ani dat)

Ověřeno čtením kódu a (jen čtením) živé databáze 27. 11. 2026. Co nešlo ověřit, je označeno „neověřeno“.

## Úkol 2 – vložení materiálu

1. **Moje učebnice → „Nová učebnice“** (`src/pages/TeacherTextbooks.tsx:1279`). Dialog: „Předmět *“, „Název učebnice“, „Popis (nepovinné)“ → „Vytvořit“ (`CreateTextbookDialog.tsx:112-150`).
2. V detailu učebnice, sekce „Struktura učebnice“ → **„Téma“** → „Název tématu“, „Ročník“ / „Bez ročníku“ → „Vytvořit téma“ (`TeacherTextbooks.tsx:858-871, 1026-1054`).
3. Tlačítka „Lekce“ a „Importovat soubor“ se objeví až po založení prvního tématu (`TeacherTextbooks.tsx:873-884`).
4. Možnosti vložení přímo do učebnice:
   - **„Importovat soubor“** – dialog „Importovat soubor do učebnice“. Přijme PDF, DOCX, PPTX, JPG, PNG, WEBP; **ne Excel, TXT, starý .doc ani odkaz**. Max 25 MB (`ImportTextbookFileDialog.tsx:47-51`). Vždy používá AI („Zpracovat pomocí AI“). Pole „Pojistka: vložte text ručně“ je jen doplněk, soubor je i tak nutný.
   - **„Lekce“** – prázdná lekce („Název lekce“, „Téma“ → „Vytvořit lekci“), text/obrázky se pak vkládají ručně v editoru (vložení obrázku ze schránky funguje, převod dokumentu ne) (`TeacherTextbooks.tsx:564-583`, `BlockEditor.tsx:1760-1789`).
5. Co import udělá s nadpisy a tabulkami: AI je převede na bloky „nadpis“ a „tabulka“ (`process-file-content/index.ts:91-95`). Není to kopie původního rozvržení; u naskenovaných souborů aplikace sama upozorňuje, že tabulky nemusí být přesné (`ImportTextbookFileDialog.tsx:680-688`). Obrázky z PDF/DOCX/PPTX se vloží (kromě EMF/WMF).
6. Jinde (ne do učebnice): **„Z materiálu“** (fotky max 6, PDF/DOCX/PPTX) vytvoří pracovní list, aktivitu nebo prezentaci – ne lekci (`FromMaterialView.tsx:129-135, 235-290`). **Studio** (`/ucitel/studio`) má „Vložit text“, „Nahrát soubory“ (i XLSX, TXT), „Fotky z galerie“, „Vyfotit“, „Vložit odkaz“, „Z lekce“ – vznikne aktivita (`SourceInput.tsx:60-93`). Přesná položka menu pro „Z materiálu“: neověřeno.

## Úkol 3 – vytvoření lekce z materiálu

1. Po „Zpracovat pomocí AI“ se zobrazí **„Návrhy lekcí“** – nic ještě není uložené (`ImportTextbookFileDialog.tsx:581-669`).
2. Přepínač „Importovat jako jednu lekci“ je zapnutý; po vypnutí „AI zkusí obsah rozdělit do více samostatných lekcí“ (dělení přesně podle nadpisů: neověřeno).
3. U návrhu: „Zahrnout lekci“, úprava názvu, „Upravit obsah“.
4. Zvolit „Téma, do kterého importovat“ → **„Uložit lekce“**. Lekce vznikne jako **Koncept** (`:555-563`).
5. Úprava: klik na název lekce → panel se záložkami „Obsah lekce“ / „Aktivity“. Stav „Koncept / Naplánováno / Publikováno“. **Neukládá se samo – nutné „Uložit změny“** (`TeacherTextbookLessonEditorSheet.tsx:129-161, 360-386`).
6. Z řádku lekce (na telefonu v „⋯“): **„Pracovní list“**, **„Vygenerovat pracovní list z této lekce“** (AI), **„Spustit prezentaci“**, **„Upravit prezentaci“** (`TextbookGradeGroups.tsx:184-243`). Aktivita: v lekci záložka „Aktivity“ → „Vytvořit z lekce“ (před „Vložit“ nutné zaškrtnout „Zkontroloval/a jsem obsah a správné odpovědi“), nebo Studio → „Z lekce“ (`CreateFromLessonDialog.tsx:66-112`).

## Demo / zkušební účet (ověřeno v živé databázi)

1. **5 AI volání na účet a 150 celkem za den pro všechna dema** (`demo_config`). Pak hláška „Demo má limit AI generování…“.
2. Každý import = min. 1 AI volání (u souboru s obrázky ještě 1 navíc na rozpoznání obrázků). Stejně „Vygenerovat pracovní list“, OCR fotek, načtení odkazu.
3. **Zásadní: demo účet nesmí upravit ani smazat lekci v učebnici** (živé pravidlo `demo_guard_update` / `demo_guard_delete` na lekcích učebnic). Import a uložení se nejspíš povede (neověřeno), ale pak **„Uložit změny“ a přepnutí na „Publikováno“ selže**.
4. Nahrávání obrázků v demu max 2 MB a 20 souborů.
5. Založení dema: 20 účtů za hodinu z jedné IP adresy, 500 za den (`create-demo/index.ts:28-37`). Zvýšení pro akci existuje jen jako neschválený návrh. Hodnota 80/h: neověřeno.

## Doporučení pro 50 lidí (cca 10 min na úkol)

1. **Nepoužívat demo** pro Úkol 3 – kvůli zákazu úprav lekcí a limitu 150 AI/den (50 × 3–4 volání se nevejde). Účastníci potřebují běžný učitelský účet, nebo předem připravit demo účty (ne z jedné Wi-Fi najednou – blokuje 20/h).
2. Rozdat **jeden stejný krátký soubor**: DOCX nebo PDF s textem (ne sken), 1–3 strany, max pár obrázků, s nadpisy. Nechat zapnuté „Importovat jako jednu lekci“.
3. Nespouštět všech 50 najednou na jeden pokyn – po skupinách (např. po řadách), import jedné lekce trvá desítky sekund, AI může vrátit „přetížení“. Kapacita pro 50 současně: neověřeno.
4. Vyvarovat se: Excelu, TXT, .doc, odkazů a skenů v importu; velkých PPTX; zapomenutého „Uložit změny“; zaměny „Z materiálu“ (nevytváří lekci) s „Importovat soubor“.
5. Nejkratší cesta: Nová učebnice → Téma → Importovat soubor → Zpracovat pomocí AI → Uložit lekce → klik na lekci → Publikováno → Uložit změny → „Vygenerovat pracovní list z této lekce“.

Žádné změny kódu, dat ani nasazení se nenavrhují.
