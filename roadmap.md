# Roadmap

## Prezentace z lekce — věrnost a ukládání (2026-09-29)
- [x] A: Zapojit uloženou učitelskou verzi do editoru i projektoru.
- [x] A: Zachovat ruční obsah, pořadí, smazání a zámek snímku.
- [x] B: Zachovat h3/h4, blokové typy, lokální barvy a kontrast.
- [x] B: Rozdělit přeplněné skupiny bez tichého ořezu.
- [x] Sjednotit editor, projektor a PDF a ověřit regresní testy.

- [x] FÁZE 1: Sjednotit styly bloků prezentace s lekcí.
- [x] FÁZE 2: Zachovat lokální nadpisová pozadí, hero, oddělovače a výšky skupin.
- [x] FÁZE 3: Doplnit regresní testy a vizuálně ověřit lekci „Úvod maso“.
- [x] Ověřit build a všechny relevantní testy.

## Promítací režim lekce (2026-09-23)
- [x] Přidat blokům slideBreakBefore a hiddenInPresentation (typ + BlockEditor UI).
- [x] blocksToSlides: filtrovat skryté bloky, respektovat ruční zalomení.
- [x] Launcher: vždy čerstvé snímky z lekce, bez merge a bez zápisu do teacher_presentations.
- [x] Seznam Prezentace: propojené = jen náhled/spuštění + poznámka, bez editoru/tématu.
- [x] Nové regresní testy; ověřit build a testy.
## Závěrečné vyhodnocení živé hry (2026-09-29)
- [x] Osobní karta žáka: správné otázky a otázky k procvičení.
- [x] Učitelský přehled otázek seřazený podle úspěšnosti.
- [x] Rychlá hra ze slabých otázek pod 50 %.
- [x] Regresní testy, build a praktické ověření.

## A4 editor pracovních listů (2026-09-29)
- [x] Nahradit formulářový seznam živým A4 plátnem se stránkováním.
- [x] Přesunout metadata a vlastnosti položek do pravého panelu.
- [x] Sjednotit vzhled položek, palety a 21:9 záhlaví s editorem lekcí.
- [x] Ověřit ukládání, výběr položek, tisk/PDF regresními testy, build a testy.
## Kontextová editace položek pracovních listů (2026-09-29)
- [x] Přesunout vlastnosti položek z pravého panelu do kontextového editoru u bloku.
- [x] Sjednotit `write_lines` na jedno nastavení a odstranit dvojité vykreslení linek.
- [x] Rozšířit náhled a editor tabulek na dostupnou šířku A4.
- [x] Ověřit reprezentativní typy, stránkování, tisk/PDF, build a testy.

## Výška řádků tabulek pracovních listů (2026-09-29)
- [x] Nastavit tělo tabulky na jednotnou minimální výšku 10 mm v živém A4 plátně.
- [x] Použít stejnou výšku a odsazení v tiskovém/PDF výstupu.
- [x] Ověřit sestavení a regresní testy obou výstupů.

## Formátovaný popis úkolu (2026-09-30)
- [x] Přidat jednoduchý editor: tučně, kurzíva, podtržení a barva textu.
- [x] Bezpečně zobrazit HTML žákovi a zachovat staré prosté texty.
- [x] Ověřit vytvoření, úpravu, zobrazení a regresní testy.


## Živá MCQ hra ve stylu sdílené obrazovky (2026-10-02)
- [x] Projekce ukazuje text otázky a všech možností s barevnými tvary.
- [x] Žák vybírá pouze barevný tvar bez textu možnosti.
- [x] Po zveřejnění projekce ukazuje rozložení odpovědí, správnou možnost a oba žebříčky.
- [x] Ověřit sestavení a vykreslení žákovských voleb, projekce a grafu regresním testem.
