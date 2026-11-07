# Mini poznámky (tahák) – upravený návrh

Pouze návrh. Nic se neimplementuje, DB se nemění, žádné e-maily ani nasazení. Myšlenkové mapy i tahák čekají na „schvaluji“. Tato verze nahrazuje předchozí návrh taháku; zjištění o existujícím kódu (lišta Kartičky/Kvíz/Shrnutí v `LessonStudyBar.tsx`, `lesson-study.ts`, sešit, portfolio, tisk) platí beze změny.

## Co se mění oproti předchozímu návrhu

- Žádná AI (vypouští se režim `cheatsheet` v `lesson-study-helper`).
- Místo A4 listu **malá oboustranná karta cca 85 × 55 mm** (velikost vizitky): krátké body, zkratky, symboly.
- **Tisk více karet na A4**: 10 karet (2 × 5) s ořezovými značkami; zadní strany zrcadlově na druhém listu pro oboustranný tisk.
- **Nenápadná doplňková funkce**: ne hlavní tlačítko, ale položka v nabídce „Další ⋯“ v liště u lekce a v „Učím se“.
- Bez slibů o lepších výsledcích a bez souvislosti s písemkami.

## Názvy a texty (neutrální)

Doporučené varianty:
1. **„Mini poznámky“** (doporučuji jako hlavní název) – zcela neutrální.
2. **„Tahák – krátké poznámky“** – pokud chcete zachovat slovo, které žáci znají.

Krátký popis v aplikaci:
> „Mini poznámky: malá karta, kam si můžeš krátce zapsat body, zkratky nebo symboly z lekce. Je to jen volitelná možnost – můžeš si ji vytisknout nebo mít v mobilu.“

Zakázané formulace v textech: „zlepší učení“, „lepší známky“, „k písemce“, „na test“, „efektivní metoda“ apod. Hlídat testem na texty v jednom slovníku.

## Karta

- Přední a zadní strana, každá max cca 6 řádků / 250 znaků (ukazatel „vejde se“).
- Volitelný nadpis, odrážky, tučné zvýraznění, jednoduché symboly (→, ≈, ✓, ✗, ↑, ↓, Δ, °C) z panelu.
- Žák může vložit pojmy z lekce (zaškrtávací seznam z bloků lekce), ale text si píše sám.
- Písmo v tisku min. 7 pt (malá karta), černobílý i barevný tisk z Bezli tokenů.
- Mobil: karta přes celou šířku, přepínač Přední/Zadní, cíle ≥ 44 px, 390 px bez vodorovného posunu.

## Kde v aplikaci

| Místo | Co |
|---|---|
| Lišta u lekce (`LessonStudyBar.tsx`) | položka „Mini poznámky“ v nabídce „Další ⋯“ |
| „Učím se“ | sekce „Moje mini poznámky“ (sbalená, dole) |
| Sešit | „Vložit do sešitu“ (stránka s kartami) |
| Tisk | jedna karta nebo arch 10 karet na A4 |

Vynecháno: AI, úkol „Vytvoř si tahák“ s hodnocením, vazba na zkoušky (`UpcomingExamsCard`), portfolio (lze doplnit později).

## Nastavení učitele „povolit tahák u písemky“

Doporučení: **vynechat**. Aplikace nic nevynucuje, údaj by jen sváděl k výkladu „nástroj k písemce“. Pokud učitel tahák u písemky povolí, napíše to do zadání písemky běžným textem.

## Data a soukromí

- Bez DB: karty ukládat do sešitu žáka (`notebook_pages.content` JSON s novým klíčem `miniNotes`); oprávnění dědí sešit – vidí jen žák. Učitel ani rodič je nevidí.
- Demo: dědí stávající demo ochrany sešitu.
- Varianta s tabulkou (seznam karet napříč lekcemi) jen jako budoucí možnost, SQL teď nepřipravuji.

## Rizika a testy

- Přetečení textu na malé kartě → limit a ukazatel.
- Oboustranný tisk: zrcadlení zadních stran a ořezové značky ověřit v PDF.
- Testy: limity karty, rozmístění 10 karet na A4 a zrcadlení, výběr pojmů z bloků, slovník textů bez zakázaných formulací; Playwright 390/1440 px.

## Etapy

1. **Nejmenší krok (jen frontend, bez DB):** „Mini poznámky“ v nabídce u lekce, editor jedné karty (přední/zadní), tisk karty i archu 10 karet, uložení do sešitu.
2. Seznam karet v „Učím se“, víc karet k jedné lekci.
3. (Volitelně) portfolio nebo samostatná tabulka.

Soubory (etapa 1): `src/lib/mini-notes.ts` (model, limity, rozmístění na A4), `src/lib/mini-notes-print.ts`, `src/components/mini-notes/MiniNoteEditor.tsx`, `MiniNoteCard.tsx`, úprava `LessonStudyBar.tsx`, testy v `src/test/`.

## Na čem se rozhodnout
1. Název: „Mini poznámky“, nebo „Tahák – krátké poznámky“?
2. Souhlasíte s vynecháním nastavení „povolit tahák u písemky“?
3. Ukládat do sešitu (bez DB)?
4. Schvalujete etapu 1?
