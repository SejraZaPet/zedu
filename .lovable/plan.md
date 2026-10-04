# Diagnóza: žák nemůže vyplnit pracovní list „Distanční výuka – Výživa – opakování"

## Co ukazují data
- Úkol: typ `pisemne` (ne zvláštní „distanční" režim — „Distanční výuka" je jen v názvu), individuální, 3 pokusy, zveřejněný.
- **Termín: 4. 10. 2026 22:15:00 UTC.** Úkol vytvořen 22:10:38.
- Pokus žáka založen **22:14:58 — 2 sekundy před termínem**. Poslední autosave 22:15:07, odpovědi prázdné.
- RLS, propojení úkol → pokus i načtení pracovního listu fungují (pokus vznikl, autosave proběhl).

## Přesná příčina (kód)
1. `StudentAssignmentPlayer.tsx` ř. 373–374: `isReadOnly = status !== "in_progress" || isDeadlinePassed`. Termín se přepočítává při každém vykreslení, takže 2 s po otevření se úkol přepne na „jen pro čtení".
2. `WorksheetPlayer.tsx` ř. 177 + 180: autosave hook dostane `editable: !locked` (po termínu `false`), ale vnitřní stav `submitted = useState(locked)` se nastaví jen při prvním vykreslení a už se nezmění. Pole proto **nevypadají zablokovaná**, ale `setAnswer` v `useWorksheetAutosave.ts` ř. 161 při `!editable` každé psaní tiše zahodí → přesně „pole nereagují".
3. Termín se žákovi i v seznamu úkolů zobrazuje jen jako datum („Do 4. 10."), bez času — nikdo neviděl, že zbývají minuty.
4. Vedlejší: položky `write_lines` se vykreslují přes `LayoutBlockItem` (linky k ručnímu psaní) — ty nejsou určené k digitálnímu vyplnění ani mimo tento bug; interaktivní je jen `short_answer`.

Tedy: nejde o RLS ani o zvláštní chování „distanční výuky" — termín byl nastaven pár minut po vytvoření (pravděpodobně omylem čas), a přehrávač po vypršení ztichne bez vysvětlení.

## Navrhovaná oprava (po schválení)
1. **Okamžitě (data):** učitelka posune termín úkolu — žák pak může pokračovat ve stejném pokusu. Mohu to udělat za ni, když potvrdíte nový termín.
2. **WorksheetPlayer:** synchronizovat zablokování s prop `locked` (pole se viditelně zablokují), a při vypršení termínu během práce zobrazit jasné hlášení „Termín vypršel" místo tichého ignorování.
3. **Zobrazení termínu s časem** na stránce úkolu i v seznamu „Moje úlohy" (např. „Do 4. 10. 22:15").
4. **Zadávání úkolu:** upozornit učitele, když termín je méně než ~1 hodinu od teď.
5. `write_lines` v digitálním režimu: volitelně nabídnout textové pole místo linek — jen pokud si to přejete (samostatné rozhodnutí).
