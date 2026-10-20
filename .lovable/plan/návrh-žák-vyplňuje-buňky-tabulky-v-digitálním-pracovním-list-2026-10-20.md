# Návrh: žák vyplňuje buňky tabulky v digitálním pracovním listu

Tento návrh vychází jen ze čtení kódu. Nic nebylo změněno.

## 1. Jak je tabulka definovaná dnes a proč ji žák nemůže vyplnit
- Typ položky je `table` (`src/lib/worksheet-spec.ts:40`). Data jsou jen `tableRows: string[][]` (první řádek je hlavička) a `tableCaption` (`:251-253`). **Neexistuje žádný příznak, který by buňku označil jako „k vyplnění“ nebo „pevnou“.**
- Učitel upravuje jen text buněk v `TableFieldsEditor.tsx:115-123`. Komentář v souboru (`:5`) výslovně říká, že u žáka je tabulka jen ke čtení.
- Žák ji vidí přes `TableItem.tsx:1-46`. Komponenta je záměrně jen ke čtení: `value` ani `onChange` nepoužívá.
- `WorksheetPlayer.tsx:252-256` řadí `table` mezi neinteraktivní bloky. Tabulka se proto nepočítá do postupu, do odpovědí ani do bodů.
- **Sešit (Digitálně) a úkol vykreslují tentýž `WorksheetPlayer`**, takže omezení platí v obou stejně. Na tabletu nejde o problém s dotykem, ale o chybějící funkci.

## 2. Ukládání: bez migrace
- Odpovědi se ukládají jako JSON s položkami podle ID položky (`answers`). Používá se v `assignment_attempts.answers` i `student_worksheet_work.answers` (`src/lib/worksheet-work.ts:44-76`). Typ hodnoty je `string | string[]` (`worksheet-items/types.ts:11`).
- Tabulka uloží pod svým `item.id` pole textů v pořadí řádek po řádku: `answers[item.id] = ["", "odpověď", …]`. Index buňky je `řádek × počet sloupců + sloupec` a počítá se bez hlavičky. Pevné buňky zůstanou v poli prázdné.
- **Schéma databáze ani oprávnění se nemění, migrace není potřeba.** Autosave, obnovení i odevzdání už fungují přes stávající `useWorksheetAutosave`, beze změny.

## 3. Vyhodnocení: nejmenší varianta, nic se automaticky nehodnotí
- Tabulka **nedostane body automaticky**. Do celkového skóre ze `scoreWorksheet` (`WorksheetPlayer.tsx:85`) nevstoupí, takže výsledky stávajících listů se nezmění.
- Učitel uvidí vyplněnou tabulku ve výsledcích (`WorksheetAttemptGrading.tsx:142`). Tabulka je tam mezi `LAYOUT_TYPES` a zobrazí se jen tehdy, když má odpověď, což sedí. `formatAnswer` (`:91`) rozšířím tak, aby odpověď tabulky zobrazil jako malou tabulku nebo řádky „Hlavička: hodnota“. Učitel ji může ohodnotit ručně stávajícími poli „Body“ (stav „Ruční hodnocení“).

## 4. Co se změní pro učitele a žáka
**Učitel (editor):** v `TableFieldsEditor` u každé buňky mimo hlavičku přibude přepínač „k vyplnění“. Prázdné buňky jsou k vyplnění automaticky, takže starší listy začnou fungovat bez úprav. Uloží se do nového nepovinného pole `tableEditable?: boolean[][]` ve specifikaci listu, které je součástí JSON listu, ne sloupcem v databázi.
- Výchozí pravidlo, když pole chybí: buňka je k vyplnění, právě když je v `tableRows` prázdná a není v hlavičce.

**Žák:** v `TableItem` dostane každá buňka k vyplnění běžné `<textarea>` s automatickou výškou. Platí pro ni:
- `min-h-11` (44 px), písmo 16 px (iOS tak nepřibližuje stránku) a `aria-label` ve tvaru „Řádek X, sloupec Y“;
- **bez `touch-action: none`, bez překryvu a bez `preventDefault`**, takže funguje klávesnice i systémové rozpoznání rukopisu (Apple Pencil Scribble, pero ve Windows);
- `disabled` po odevzdání nebo zamčení, stejně jako ostatní položky.

**Zapojení do přehrávače:**
- `WorksheetPlayer` bude tabulku považovat za interaktivní jen tehdy, když má alespoň jednu buňku k vyplnění. Tabulka bez prázdných buněk zůstane čistý podklad, takže se nezmění číslování ani postup stávajících listů.
- `isItemAnswered` u tabulky: alespoň jedna buňka je vyplněná.

**Sešit i úkol:** obojí jde přes `WorksheetPanel` → `WorksheetPlayer`. Úkol (`NotebookWorksheetPage.tsx:103`) zapisuje do stejného `assignment_attempts`, vlastní práce do stejného `student_worksheet_work`. Ověřím to testem: tentýž pokus se otevře v sešitě i z úkolu a hodnoty buněk se shodují.

## 5. Rizika a jak je ošetřit
- **Starší listy s tabulkami, které mají jen pevný obsah:** bez prázdných buněk se nic nezmění, tabulka zůstane podkladem.
- **Starší listy s prázdnými buňkami** (výchozí šablona `worksheet-defaults.ts:213` má prázdný řádek): začnou být vyplnitelné a přibudou do postupu „Vyplněno X/Y“. To je záměr. Učitel to může vypnout přepínačem.
- **Už odevzdané pokusy:** odpověď k tabulce v nich není, takže se zobrazí jako „bez odpovědi“, a to jen když má tabulka buňky k vyplnění. Body ani skóre se nepřepočítávají. Uložené hodnocení učitele zůstane, protože položka nemá body automaticky.
- **Tisk a PDF** (`worksheet-print-renderer.ts:1069-1086`): prázdný list zůstane jak je, buňky k vyplnění jsou prázdné. Tisk s odpověďmi (žákovské PDF) doplní hodnoty do buněk. Výška řádku zůstane 10 mm (test `worksheet-table-row-height`).
- **Převod listu do sešitu (PDF pro pero):** používá stejný tiskový výstup, takže chování se nezmění.
- **Tabulky v lekci nebo prezentaci:** jsou to jiné bloky (`blocks-to-slides`, `TableBlock`), tato změna se jich netýká.
- **Živé hry a AI generování:** pole `tableEditable` je nepovinné. Schéma pro AI (`worksheet-spec.ts:440`) zatím neměním, tabulky z AI se řídí výchozím pravidlem prázdných buněk.

## Technické shrnutí souborů
- `src/lib/worksheet-spec.ts`: nepovinné `tableEditable?: boolean[][]` a pomocná funkce `isTableCellEditable(item, r, c)`.
- `src/components/worksheet/TableFieldsEditor.tsx`: přepínač „k vyplnění“ u buňky.
- `src/components/worksheet-items/TableItem.tsx`: buňky s `<textarea>`, `value: string[]`.
- `src/components/WorksheetPlayer.tsx`: interaktivita tabulky podmíněná buňkami k vyplnění, `isItemAnswered`, žádné body.
- `src/components/admin/WorksheetAttemptGrading.tsx`: zobrazení odpovědi tabulky.
- `src/lib/worksheet-print-renderer.ts`: doplnění odpovědí do buněk při tisku s odpověďmi.
- Testy:
  - výchozí pravidlo prázdných buněk;
  - uložení a obnovení `string[]`;
  - beze změny skóre;
  - starý list s pevnou tabulkou zůstane neinteraktivní;
  - tentýž pokus v sešitě i v úkolu.
- Databáze, oprávnění a demo ochrany zůstávají beze změny.
