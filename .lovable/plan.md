# Diagnostika: bílá stránka po přidání páru ve „Spojování“ (editor pracovního listu)

Jen nález a návrh. Nic se neměnilo, žádná DB změna není potřeba.

## Nález (příčina)

1. Editor párů: `src/pages/WorksheetEditor.tsx` ř. 4018–4067. Tlačítko „Přidat pár“ (ř. 4062) přidá `{ left: "", right: "" }`. Úprava inputů je v pořádku (kopie pole, `next[idx]`), nic tu nespadne.
2. Hned pod editorem se položka vykresluje živě na „papíře“: `WorksheetEditor.tsx` ř. 3493 + 3542 → `ITEM_RENDERERS.matching` = `src/components/worksheet-items/MatchingItem.tsx`.
3. `MatchingItem.tsx` ř. 41–45 vytvoří pro každou pravou stranu `<SelectItem value={r}>`. Nový pár má `right = ""`. Radix Select **vyhodí výjimku při renderu**, když má `SelectItem` prázdnou hodnotu („A <Select.Item /> must have a value prop that is not an empty string“). Radix vykresluje položky i u zavřeného / zakázaného selectu (kvůli sběru kolekce), takže chyba nastane okamžitě.
4. Proč „třetí řádek“: výchozí aktivita má 2 vyplněné páry. Přidáním 3. páru vznikne prázdná pravá strana → pád. Když učitelka začne psát do 3. řádku vlevo, pravá zůstává prázdná → pád trvá. Stejně spadne, když vymaže pravou stranu u kteréhokoli páru.
5. V aplikaci není žádný `ErrorBoundary` (rg v `src/` nic nenašel), proto celá stránka zbělá.

Vedlejší nálezy (nepadají, ale opravit spolu):
- Dvě stejné pravé strany → duplicitní `value` v Selectu (nejasný výběr). Klíče `key={ri}` jsou indexy, což tu nevadí.
- „Přidat pár“ neaktualizuje `correctAnswer` (ostatní akce ano) – klíč je o pár kratší, dokud se nepíše.
- Tiskový renderer (`worksheet-print-renderer.ts` ř. 1011–1030), `shuffleNonIdentity` (má pojistku proti nekonečné smyčce) a `WorksheetPlayer` hodnocení jsou v pořádku; prázdné páry jen vypíšou prázdnou buňku.

## Návrh minimální opravy

A) `MatchingItem.tsx`
- Nabídku stavět jen z neprázdných, unikátních pravých stran: `pairs.map(p => (p.right ?? "").trim()).filter(Boolean)` + odstranit duplicity.
- Ošetřit `pairs` s chybějícím `left/right` (`?? ""`).
- Pokud nabídka prázdná, místo Selectu zobrazit tlumený text „Doplňte pravou stranu“ (jen v náhledu; žák prázdné páry nedostane, viz B).
- Hodnoty a hodnocení beze změny (pořád text pravé strany).

B) Žákovský pohled / tisk: prázdné páry přeskočit jen při zobrazení (nemazat je ze specifikace) – `WorksheetPlayer` a print renderer filtrují páry s prázdnou stranou.

C) `WorksheetEditor.tsx` ř. 4062: „Přidat pár“ zároveň zavolá `onUpdateKey({ correctAnswer: next.map(...) })` jako ostatní akce.

D) Minimální `ErrorBoundary`
- Nová komponenta `src/components/EditorErrorBoundary.tsx` (třídní komponenta, `componentDidCatch` jen `console.error`).
- Obalit jen obsah papíru (náhled položek) uvnitř `WorksheetEditor`, ne celý editor, aby stav editoru, undo a autosave zůstaly naživu a nic se neztratilo. Hláška: „Náhled této aktivity se nepodařilo zobrazit. Vaše práce je uložená, upravte prosím aktivitu nebo klikněte na Zkusit znovu.“ + tlačítko „Zkusit znovu“ (reset boundary; `resetKeys` = JSON položky, takže po opravě dat se sám obnoví).
- Volitelně druhá, obecná boundary okolo `<Routes>` v `App.tsx` s tlačítkem „Načíst znovu“.

Žádná změna DB, RLS, bodování ani ukládání – chyba je čistě v zobrazení.

## Regresní testy (chybí dnes)

Existuje `src/test/matching-shuffle.test.tsx` (jen míchání). Chybí:
1. `MatchingItem` vykreslí 3 páry, kde 3. má `right: ""` → nespadne, nabídka obsahuje 2 možnosti.
2. Duplicitní pravé strany → nabídka bez duplicit.
3. Páry s `undefined` left/right → nespadne.
4. `EditorErrorBoundary` při chybě potomka zobrazí hlášku a tlačítko, nikoli prázdno.
5. Print renderer s prázdným párem nevyhodí výjimku.

Poznámka: běh celé sady je v sandboxu blokovaný chybějícím nativním `canvas`; testy výše canvas nepotřebují, lze je spustit cíleně.

## Ověření
Playwright: otevřít list, přidat „Spojování“, „Přidat pár“, psát do 3. řádku → stránka nezbělá, náhled ukazuje 3 řádky.

## Rollback
Čistě kódový: vrátit změny v `MatchingItem.tsx`, `WorksheetEditor.tsx`, `WorksheetPlayer.tsx`, `worksheet-print-renderer.ts` a smazat `EditorErrorBoundary.tsx` + nové testy. Data neovlivněna.
