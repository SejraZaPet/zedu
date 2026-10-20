# Diagnostika: psaní do pracovního listu v sešitě na tabletu

Pouze čtení. Nic nebylo změněno. Příčinu jsem zjistila čtením kódu, na skutečném tabletu ani s daty učitelky jsem ji nezkoušela. Je proto **nepotvrzená** a jejím ověřením začíná návrh opravy.

## 1. Jak sešit zobrazuje vložený list
- `src/pages/MyNotebook.tsx:671-683` zobrazuje u stránky v režimu „Digitálně“ **místo plátna** komponentu `NotebookWorksheetPage`. Plátno pro kreslení (`NotebookCanvas`) se u takové stránky vůbec nevykreslí. Nad listem tedy není žádné plátno, překryvná vrstva ani iframe.
- `src/components/notebook/NotebookWorksheetPage.tsx:94-131` vykresluje stejný `WorksheetPanel` / `WorksheetPlayer` jako otevření z úkolu (`StudentAssignmentPlayer`) nebo ze stránky listu (`StudentWorksheetView`).
- „PDF pro pero“: stránky jsou obrázky JPEG v `NotebookCanvas`. Jsou zamčené (`pointer-events-none`, `NotebookCanvas.tsx:480`) a leží pod kreslicí vrstvou (`:500-503`). Žádná políčka k vyplnění tam nejsou, píše se jen nástroji sešitu.

## 2. Dotykové a pointer události
- `NotebookCanvas.tsx:466-472`: plocha má `touch-none` a vlastní obsluhu pointerů. `preventDefault` a `setPointerCapture` se volají jen mimo režim Výběr (`:140-151`). Ochrana proti opření dlaně (`:131-137`) ignoruje dotyk prstem do 1 s po použití pera.
- Tato pravidla se týkají jen stránek „PDF pro pero“. U digitální stránky nic z toho neexistuje.
- Klávesové listování (`MyNotebook.tsx:251-263`) ignoruje psaní do polí, neblokuje ho.
- Pravidla `pointer-events: none` ve `worksheet-editor.css:133-162` patří jen do učitelského editoru, žákovský list je nepoužívá.
- **Závěr:** v kódu jsem nenašla žádnou vrstvu, která by v digitálním režimu blokovala dotyk.

## 3. Vliv nástroje sešitu
- U digitální stránky se nástroje sešitu nezobrazují ani nepoužívají. Přepnutí nástroje nic nezmění.
- U „PDF pro pero“ musí být zvolené Pero, Zvýrazňovač nebo Text. Ve Výběru se nekreslí (`:142-147`). Do políček listu se tam psát nedá ze své podstaty, list je obrázek.

## 4. Ukládání odpovědí
- List bez úkolu se ukládá jako vlastní práce přes `student_worksheet_work`, stejně jako mimo sešit.
- List s úkolem používá `loadOrCreateIndividualAttempt` (`worksheet-attempt.ts:87-118`). Stejné pokusy a odevzdání přes `submitWorksheetAttempt` používá i stránka úkolu, takže odpovědi se ukládají stejně.

## Pravděpodobné příčiny (nepotvrzené), které vysvětlí „mimo sešit to jde“
1. **List je zamčený, ne zablokovaný dotykem.** `NotebookWorksheetPage.tsx:98-99` zamyká list, kdykoli pokus není „rozpracovaný“: po odevzdání, po vyčerpání pokusů nebo po termínu. Při vyčerpaných pokusech se zobrazí jen nenápadná poznámka (`:54`), takže to vypadá, že psaní nejde.
2. **Odkaz se uložil bez úkolu, nebo k jinému úkolu.** Vložení přes Můj sešit bere úkol z nabídky (`InsertWorksheetButton.tsx:70`). Když se vybere list bez vazby na úkol, sešit otevře „vlastní práci“, nikoli pokus úkolu. Psát by se dalo, ale odpovědi z úkolu by chyběly.
3. **Tabulka v elektronickém listu je u žáka jen ke čtení.** Je to známé omezení z dřívější diagnostiky. Pokud učitelka zkoušela psát do tabulky, nepůjde to ani v sešitě.
4. **Skupinový nebo uzamčený úkol:** sešit místo listu zobrazí hlášku (`:45-47`).
5. **Účet učitele:** `isStudent` je nepravda (`MyNotebook.tsx:63`). List se otevře bez ukládání a bez pokusu.

## 5. Návrh opravy (zatím neprovádět)
1. **Ověřit příčinu jen čtením.** Najdu stránku sešitu, kterou učitelka hlásí, a zjistím, jestli má odkaz na úkol, v jakém stavu jsou pokusy a jaký typ položky nejde vyplnit. Do chatu nebudu vypisovat odpovědi ani jména. Na tabletu (dotyk a pero) zopakuji vlastní `[TEST]` průchod a pak smažu jen svá testovací data.
2. Podle výsledku nejmenší změna jen v zobrazení:
   - Pokud jde o zamčení: nad listem zobrazit výraznou hlášku s důvodem (odevzdáno, pokusy vyčerpány nebo termín) místo tiché poznámky. Logika pokusů zůstane stejná.
   - Pokud jde o chybějící vazbu na úkol: v nabídce vložení zvýraznit list s úkolem. Chování vložení zůstane stejné.
   - Pokud jde o tabulku: oddělený návrh ukládání buněk, který vyžaduje zvláštní schválení.
   - Pokud by se přece jen našla blokující vrstva: na úrovni listu povolit dotyk (`touch-action: auto`, `pointer-events: auto`), a to jen u digitální stránky.
3. **Co by mohlo rozbít:** psaní perem na stránkách „PDF pro pero“, pokud by se měnila plocha plátna (proto se nemění), a pravidla pokusů a termínů (proto se nemění). Databáze, oprávnění ani odpovědi se nemění.
