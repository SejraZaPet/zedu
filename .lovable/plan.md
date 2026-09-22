# Sjednocení vizuálu prezentace s lekcí

## Cíl
Prezentace vytvořená z lekce bude u jednotlivých obsahových bloků používat stejné barvy, rámečky, typografické poměry a rozložení jako lekce. Tmavý rámec celého snímku může zůstat.

## Implementace
1. **Sdílené styly bloků**
   - Ve vykreslení snímku použít stejný `blockBackgroundStyle` jako v lekci pro nadpisy, odstavce, seznamy a další bloky s vlastním pozadím.
   - Callouty vykreslit přes sdílenou paletu `CALLOUT_STYLES`, včetně stejné ikony, pozadí, rámečku, tmavého textu a proporcí.
   - Tabulkám vrátit světlý vzhled lekce, jemné ohraničení a přibližně 14px text.
   - Sjednotit poměry H1–H4 a seznamů s lekcí, pouze s přiměřeným škálováním pro 16:9.

2. **Přenos struktury lekce**
   - Nadpis s vlastním pozadím ponechat jako lokální blok; při slučování zachovat celé údaje o pozadí, ne pouze barvu.
   - Rozšířit převod vstupu tak, aby úvodní snímek převzal hero obrázek lekce, pokud je ve zdrojových datech dostupný.
   - Přenést oddělovač jako viditelný blok na konci příslušného snímku, aniž by přestal oddělovat sekce.
   - Přenést a ve všech běžných rozloženích respektovat `groupMinHeight` i `groupHeight` jednotlivých bloků.

3. **Ověření a testy**
   - Rozšířit převodní testy o lokální pozadí povýšeného nadpisu, hero obrázek, oddělovač a výšky skupin.
   - Rozšířit vykreslovací testy o shodné styly calloutu, tabulky, H1–H4, seznamu a obalu s lokálním pozadím.
   - Ověřit skutečné ID lekce „Úvod maso“, vytvořit čerstvý výstup bez změny produkčních dat a porovnat lekci s prezentací na snímcích vedle sebe.
   - Spustit relevantní testy a zkontrolovat automatický build.

## Technické poznámky
- Zachovám současnou editovatelnost bloků, animace, vlastní ruční fonty/barvy a kontrast vůči pozadí.
- Hero obrázek bude předáván zpětně kompatibilním volitelným parametrem; existující volání bez hero obrázku zůstanou funkční.
- Testovaná lekce má podle diagnostiky správné ID `3a05447c-a100-4d9a-9993-b89a9244e190`; ID v zadání obsahuje překlep.
- Vizuální ověření nebude zapisovat čerstvou prezentaci do databáze, pokud to není nutné; použije aktuální bloky a stejný převodník jako produkční flow.
