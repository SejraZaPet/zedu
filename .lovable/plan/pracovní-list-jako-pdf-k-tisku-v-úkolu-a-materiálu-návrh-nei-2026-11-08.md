# Pracovní list jako PDF k tisku v úkolu a materiálu (návrh, neimplementováno)

## Co je dnes hotové (zjištěno čtením)

- **Tisk/PDF** běží celý v prohlížeči: `worksheet-print-renderer.ts` vyrobí stránku A4 (`@page` A4, okraje 14/14/16/14 mm, písmo Lato se systémovou zálohou, česká diakritika jako běžný text), `worksheet-pdf-export.ts` ji vytiskne přes skrytý rámeček a `window.print()`. Prohlížeč nabídne „Uložit jako PDF"; název souboru je převzatý z titulku stránky (`worksheetDocumentTitle`). Server se nepoužívá.
- Renderer podporuje všechny typy položek, včetně `mind_map`, `flow_steps` a nových `method_steps` / `practice_examples`, a také rozvržení, odpovědní linky a rámečky.
- **Žákovská verze už existuje:** `toStudentPrintSpec()` odstraní z dat `answerKeys` ještě před vykreslením a vypne klíč i poznámky pro učitele. Komponentu `StudentWorksheetPrintButtons` („Stáhnout PDF" + „Vytisknout") už používají samostatný list žáka, lekce a žákovský plán hodiny. Volitelně umí vytisknout i napsané odpovědi z místního úložiště.
- **V úkolu ani v materiálu tlačítko chybí:** `StudentAssignmentPlayer` list načte a vyplní, ale tisknout nenabízí. `MaterialWorksheetsCard` jen otevře náhled (bez klíče).
- **Starší úkoly/materiály** mají list v `worksheet_id`, materiály navíc v `settings.worksheets`. Obojí normalizuje `assignment-content.ts`, takže tlačítko půjde odvodit zpětně bez migrace.
- **Oprávnění:** čtení listu žákem hlídá politika z migrace 0082 (list vidí jen přidělený žák: třída, skupina nebo vybraní příjemci). Když list nevidí, dotaz nic nevrátí a PDF nevznikne.

## Návrh

1. **Kde bude tlačítko:**
   - Úkol (`StudentAssignmentPlayer`): v hlavičce listu „Stáhnout PDF (k tisku)" a „Vytisknout".
   - Materiál (`MaterialWorksheetsCard`): u každého listu vedle „Otevřít list" a také v otevřeném náhledu.
   - Seznam úkolů žáka: zatím ne, aby karty zůstaly přehledné (případně později).
   - Učitel (`AssignmentDetailDialog`): odkaz „Tisk pro žáky" se stejnou žákovskou verzí. Nepovinné, etapa 2.
2. **Zpětná platnost:** tlačítko se zobrazí, kdykoli má položka list podle `worksheet_id` nebo `settings.worksheets`, takže funguje i u dříve vložených úkolů a materiálů.
3. **Obsah PDF:** vždy prázdná žákovská verze, bez klíče a bez poznámek pro učitele. Kvůli úkolům navrhuji vynechat QR odkaz na samostatný list a nahradit ho odkazem na úkol, aby žák nepracoval mimo úkol. Varianta „s mými odpověďmi" jen volitelně a jen u úkolu, který žák už odevzdal.
4. **Zamčený režim / zkoušky:** dokud běží pokus v zamčeném režimu, tlačítko skrýt (tisk by vyvolal porušení režimu a umožnil vynést zadání). Po odevzdání tlačítko zobrazit.
5. **Přepínač „Tisk povolen"** v `assignments.settings.printAllowed`, bez DB:
   - Chybějící klíč znamená povoleno, staré položky tedy tlačítko mají hned.
   - U materiálu povoleno vždy.
   - U úkolu přepínač ve výchozím stavu zapnutý, učitelka ho může vypnout (např. u písemky).
   - Vypnutí jen schová tlačítko. Skutečnou ochranu dat to není (viz rizika).
6. **Mobil/iPad:** tisk ze skrytého rámečku v iOS Safari někdy vytiskne prázdnou stránku. Na dotykových zařízeních proto otevřít tiskovou stránku jako novou kartu: okno se otevře hned při klepnutí a obsah se do něj doplní, pak se zavolá tisk. Systémový dialog nabídne „Uložit do Souborů" nebo „Tisk". Název listu se použije jako titulek, tedy i jako název souboru.

## Etapy (doporučení: 1, pak 2)

- **Etapa 1 (nejmenší, jen frontend):** tlačítka v úkolu a v materiálu přes stávající `StudentWorksheetPrintButtons`, skrytí v zamčeném režimu, náhrada QR, oprava tisku na iOS.
- **Etapa 2:** přepínač „Tisk povolen" u úkolu a tisk z detailu učitele.
- **Etapa 3 (volitelně):** varianta „s mými odpověďmi" po odevzdání.
- **Etapa 4 (DB, jen po zvláštním schválení):** žákovské čtení listu bez `answerKeys` (bezpečný pohled nebo funkce).

## Testy

- Žákovské HTML neobsahuje klíč ani poznámky učitele u žádného typu položky.
- Vykreslí se všechny typy, včetně `mind_map`, `flow_steps`, `method_steps` a `practice_examples`.
- Starý úkol jen s `worksheet_id` a starý materiál se `settings.worksheets` tlačítko mají.
- Nevrácený (nepřidělený) list skončí chybovou hláškou, ne PDF.
- Při zamčeném režimu se tlačítko skryje; `printAllowed: false` ho skryje.
- Kontroly na šířce 390 px: tlačítka aspoň 44 px, bez vodorovného posunu.

## Rizika

- **Hlavní riziko, které existuje už dnes:** žák čte celé `worksheets.spec` včetně `answerKeys` (přehrávač i náhled používají `select("spec")`). PDF klíč neobsahuje, ale technicky zdatný žák ho může najít v odpovědi ze serveru. Bez změny DB to nejde opravit, proto etapa 4. Ověřit také, zda některé typy nemají správnou odpověď přímo v položce (mimo `answerKeys`).
- Tisk přes `window.print()` vypadá v každém prohlížeči trochu jinak (okraje, záhlaví prohlížeče).
- Velké obrázky zpomalí přípravu na mobilu.

## Otevřené otázky

1. Má mít úkol přepínač „Tisk povolen" (výchozí zapnuto), nebo stačí povolit tisk všude kromě zamčeného režimu?
2. QR kód v PDF: odkaz na úkol, nebo QR úplně vynechat?
3. Chcete variantu „s mými odpověďmi" (etapa 3)?
4. Připravit návrh DB pro skrytí klíče před žákem (etapa 4)?
