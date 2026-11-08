# Otevřená odpověď jako aktivita: diagnostika a plán

## Příčina (jistá)
Karta je na stránce Aktivity (`ActivitiesPage.tsx`, ř. 78 katalog, ř. 365 tlačítko). Tlačítko „Brzy“ se zobrazí vždy, když `isSupported(id)` vrátí false. V `activity-wizard.ts` (`WIZARD_TYPES`) mají `open` i `table` (Tabulka) nastaveno `blockType: null`. Editor lekce tedy tento typ bloku zatím vytvořit neumí. Je to záměrně vypnutý zástupce, ne chyba. Ukázka na kartě je jen obrázek: nic se neukládá a nehodnotí.

Stejně „Brzy“ je jen **Tabulka**. Ostatních 8 typů funguje.

## Co už existuje a dá se znovu použít
- Pracovní list: položka `open_answer` (žák píše, učitel hodnotí ručně ve `WorksheetAttemptGrading`, „Ke kontrole“ přes `grading-review.ts` – `OPEN_ITEM_TYPES`).
- Úkol s listem: pokusy, autosave a odevzdání (`assignment_attempts`), uložení hodnocení.
- Prezentace: typ slidu „Otevřená odpověď“ (`PresentationEditorDialog`).
- Výsledky aktivit v lekci: `student_activity_results.answers` (snapshot, `ActivityAnswerReview`) – dnes jen automaticky vyhodnocené typy, bez učitelského hodnocení.

Otevřená odpověď tedy funguje už teď **v pracovním listu přiřazeném jako úkol**. Chybí jen jako samostatný blok v lekci.

## Návrh po etapách (od nejmenší)

**Etapa 0 – hned, bez rizika (doporučuji):** kartu neoznačovat jen „Brzy“. Tlačítko „Vytvořit v pracovním listu“ otevře nový list s položkou Otevřená odpověď. Krátký text vysvětlí, že hodnocení probíhá v „Ke kontrole“. Mění se jen stránka Aktivity.

**Etapa 1 – blok v lekci (jen frontend):** nový `activityType: "open_answer"` v editoru lekce (otázka, limit znaků, nepovinná vzorová odpověď/kritéria jen pro učitele). Žák v lekci napíše odpověď s počítadlem znaků a koncept se mu ukládá lokálně. Odevzdání zapíše `student_activity_results` s `answers`, ale bez skóre. Vzorová odpověď se žákovi nikdy neposílá (odstraní se stejně jako u studentské verze listu). Jestli to lze bez změny DB, musím nejdřív ověřit podle sloupců a RLS politik `student_activity_results`. Když ne, ukážu SQL a počkám na „schvaluji“.

**Etapa 2 – hodnocení v „Ke kontrole“:** učitelka vidí odpovědi z lekce (jen oprávněný detail, bez výpisu jinde). Může zadat body, nebo hodnotit bez bodů, a připsat slovní komentář. Uložení hodnocení k výsledku aktivity téměř jistě vyžaduje nové sloupce nebo tabulku a politiku. Proto nejdřív ukážu SQL ke schválení.

**Etapa 3 (později):** AI návrh hodnocení podle kritérií. Hodnocení vždy schvaluje učitelka a návrh nese štítek AI. V této etapě se nedělá.

**Živá hra:** nedoporučuji. Bodování je serverové a postavené na otázkách s výběrem. Psané odpovědi na projektoru by navíc ohrožovaly soukromí dětí. Typ zůstane `liveGame: false`.

## Testy
- `isSupported("open")` v jednotlivých etapách.
- Vzorová odpověď se nedostane do žákovské verze.
- Limit znaků.
- Odevzdání neuloží žádné skóre.
- Při chybě se nic neuloží a text zůstane.
- Ostatní typy aktivit fungují beze změny.
- Mobil 390 px, ovládací prvky aspoň 44 px.

## Rizika
- Uložení učitelského hodnocení bez změny DB nejspíš nepůjde (etapa 2).
- Odpovědi žáků se nesmí objevit v logu, náhledu ani v exportu PDF bez oprávnění.
- U starých aktivit se nic nemění.

## Otevřené otázky
1. Stačí nejdřív etapa 0, nebo rovnou etapa 1?
2. Hodnotit body, slovně, nebo obojí volitelně?
3. Výchozí limit znaků (navrhuji 1000)?
4. Zapnout zároveň „Tabulku“ (zatím také „Brzy“), nebo ji nechat na později?
