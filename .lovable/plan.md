# Prezentace z lekce = promítací režim lekce

Prezentace navázaná na lekci přestane být samostatný dokument s vlastním vzhledem. Stane se pouze způsobem, jak lekci promítnout. Vzhled se vždy odvozuje z lekce, obsah se upravuje jen v editoru lekce.

## Co uvidí učitelka

- U prezentace propojené s lekcí zmizí volba „Vzhled“ i nástroje na barvy, pozadí a velikost písma. Místo nich bude věta „Vzhled se přebírá z lekce“ a tlačítko „Upravit lekci“.
- V editoru lekce dostane každý blok dvě nové volby v jeho nabídce:
  - **Začít tady nový snímek** – od tohoto bloku se při promítání začíná nový snímek.
  - **Nezobrazovat v prezentaci** – blok zůstane v lekci, ale při promítání se přeskočí.
  Oba stavy se ukazují drobným štítkem u bloku, aby bylo vidět, kde se snímky dělí a co se nepromítá.
- Tlačítko „Spustit prezentaci“ zůstane na stejném místě a promítání (projektor, další/předchozí, ukazatel postupu, časování podle plánu hodiny) bude fungovat úplně stejně. Jen se snímky pokaždé připraví z právě uloženého obsahu lekce.
- Prezentace vytvořené ručně bez lekce se nemění vůbec – mají dál svůj editor, výběr tématu a vlastní uložené snímky.
- V seznamu Prezentace u položek navázaných na lekci zůstane náhled a spuštění; akce „Aktualizovat z lekce“ a „Od nuly“ zmizí, protože ztrácejí smysl.

## Co se stane s uloženými prezentacemi

- Tabulka `teacher_presentations` zůstává a dál slouží standalone prezentacím.
- Řádky navázané na lekci se **nemažou**. Přestanou se používat jako zdroj promítání a uložené snímky se označí jako archiv (nové pole `archived_from_lesson_sync`, případně `legacy_slides`). V seznamu se u nich zobrazí poznámka „Snímky se nyní tvoří z lekce“ a nabídne se možnost archiv odstranit.
- Tím pádem přestává platit dosavadní tiché slučování ručních úprav; ruční úpravy prezentace už nebude kam ukládat. Proto: před nasazením ukážeme učitelce jednorázový přehled prezentací, které mají ruční úpravy nebo zámky, aby si případné texty přenesla do lekce.

## Technické řešení

### 1. Nové vlastnosti bloku
- Do `Block` v `src/lib/textbook-config.ts` přidat volitelná pole `slideBreakBefore?: boolean` a `hiddenInPresentation?: boolean`. Jsou součástí `blocks` JSON, žádná migrace není potřeba.
- `normalizeBlocks` je nechá projít bez změny; chybějící hodnota = `false`.
- UI přidat do nabídky bloku v `BlockEditor` (a v jeho variantě pro učitelské lekce) jako dvě přepínací položky s ikonami.

### 2. Generování snímků
- `blocksToSlides` (`src/lib/blocks-to-slides.ts`) nejdřív bloky profiltruje (`hiddenInPresentation`), pak dělí obsah: hranice snímku = dosavadní automatické dělení **nebo** `slideBreakBefore`. Ruční zalomení má přednost, automatické dělení se uvnitř takto vzniklé sekce uplatní dál (kvůli přetečení).
- Téma: u lekce se používá `theme_id` lekce, jinak výchozí; barvy, rámečky a velikosti se dál berou z bloků lekce (`block-backgrounds`, `CALLOUT_STYLES`) – tady se nic nemění, jen se odstraní možnost je v prezentaci přepsat.

### 3. Spouštění
- `usePresentationLauncher.buildSlidesForLesson` přestane načítat uložené snímky a slučovat je (`presentation-merge` zůstane v repu jen pro standalone a pro zpětné čtení archivu, případně se odstraní společně s testy, pokud nezbude uživatel).
- `quickLaunch` bude: přečti lekci → vygeneruj snímky → vytvoř `game_sessions` řádek → otevři projektor. Zápis `presentation_slides` na lekci zůstane (slouží projektoru a exportům), zápis do `teacher_presentations` u lekcí se vypustí.
- Editor prezentace se u položek s `lesson_id` nebude otevírat; místo toho odkaz do editoru lekce.

### 4. Rychlost
- Generování je čistě v prohlížeči nad už načtenými bloky; u běžné lekce jde o jednotky až desítky milisekund. Naopak zmizí dva databázové dotazy (načtení uložené prezentace a její uložení), takže spuštění bude o síťovou latenci **rychlejší** než dnes.
- Projektor a žákovská zobrazení čtou hotové snímky z relace, takže se za běhu negeneruje nic znovu.

### 5. Testy
- Nové testy: ruční zalomení tvoří nový snímek; skrytý blok se nepromítá, ale v lekci zůstává; téma prezentace se u lekce vždy odvodí z lekce.
- Úprava existujících testů slučování (`presentation-merge-saved.test.ts`) na standalone scénář nebo jejich odstranění.

## Mimo rozsah
- Chování živého promítání, přechodů, ukazatele postupu a časování podle plánu hodiny se nemění.
- Výchozí téma na úrovni učebnice/předmětu (dřívější návrh) tato změna neřeší – u lekcí přestává být potřeba.
