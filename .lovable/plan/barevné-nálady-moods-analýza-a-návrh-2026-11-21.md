# Barevné nálady (moods) – analýza a návrh

Jen analýza. Kód, databázi ani nasazení jsem neměnila.

## 1. Kde jsou dnes barvy zadané napevno (čtení kódu 21. 11. 2026)

- **Hex barvy v TS/TSX:** 97 souborů, asi 617 výskytů.
- **Tailwind třídy s pevnou barvou** (bg-purple-600, text-gray-500, from-/to-…): 105 souborů, asi 369 výskytů.
- **Základní tokeny už existují** v `src/index.css` (`--primary`, `--primary-light/-pastel/-subtle/-dark`, `--secondary-*`) a 25 dvojic přechodů dlaždic (`--dashboard-tile-*-from/-to`). Na nich stojí sdílené dlaždice žáka i učitele, takže tam se nálada přepne téměř zdarma.
- **Tmavý režim:** Tailwind má `darkMode: ["class"]`, ale v `index.css` jsem nenašla blok `.dark`. Tmavá paleta aplikace tedy dnes reálně neexistuje. Nálady nic stávajícího nerozbijí, ale „nezávislost na tmavém režimu“ znamená navrhnout i tmavou variantu každé nálady (viz etapa 4).

### Podle obrazovek (pevné barvy, orientačně)
| Oblast | Výskyt | Poznámka |
|---|---|---|
| Přehled žáka/učitele (dlaždice) | nízký | tokeny už jsou, stačí sady pro každou náladu |
| Admin / správa / editory (`components/admin`, hlavně `BlockEditor.tsx` 34) | ~186 | největší dluh; paleta 17 barev editoru je obsah, ne vzhled |
| Učím se / procvičování (`StudentPractice.tsx`) | 16 | |
| Hra žáka, přehrávač úloh | 7 + 7 | |
| Kalendář učitele/žáka | 5 + 3 | |
| Profil / nastavení (`ProfilePage.tsx`) | 5 | |
| Výuka, Úlohy, Kontrola, Učebnice, Sešit | 1–4 na stránku | |
| Notifikace (`NotificationBell`, `NotificationsPage`) | 19 | |
| Zeď (`WallResponsesList`) | 16 | |
| Pracovní listy – prvky | 6 | |
| Přihlášení, messenger | nízký | převážně shadcn tokeny |

### Co je „obsahová“ barva a měnit se nemá
`worksheet-print-renderer.ts` (109), `pdf-export-templates.ts`, `lesson-plan-pdf-export.ts`, `curriculum-pdf-export.ts`, `lesson-offline-export.ts`, `generate-login-cards.ts`, `presentation-themes.ts`, `slide-typography.ts`, `game-themes.ts`, `avatar-palettes.ts`/`avatars.ts`, `subject-appearance.ts`, `staff-colors.ts`, `notebook.ts`, `color-palette.ts`, `mcq-option-visuals.ts`, `assignment-status`. Tyto soubory tvoří většinu hex výskytů. Dohromady to je zhruba 60 % všech pevných barev, takže skutečně přepsat je potřeba asi 40 %.

## 2. Jak zavést tokeny s minimem zásahů

```text
:root                      -> Bezli (dnešní hodnoty, beze změny)
html[data-mood="minimal"]  -> přepíše jen značkové tokeny
html[data-mood="natural"]  -> totéž
.dark / html.dark[data-mood=…] -> tmavé varianty (etapa 4)
```
- Přepínat se má jen **značková vrstva**: `--primary*`, `--secondary*`, `--accent`, `--ring`, `--background`, `--card`, `--muted`, `--border`, hlavní přechod a 25 sad `--dashboard-tile-*`.
- **Stavové tokeny** (`--success`, `--destructive`, `--warning`, termín/po termínu z `assignment-status`) definovat jednou v `:root` a v blocích nálad je záměrně nepřepisovat. Hlídat to bude test.
- Atribut nastaví malý `useMood` (vedle `useAccessibilitySettings`). Při startu přečte localStorage synchronně v `index.html`, aby stránka po načtení neproblikla, a pak dorovná hodnotu z profilu.
- Pevné Tailwind/hex barvy v UI nahrazovat postupně sémantickými třídami (`bg-primary`, `text-muted-foreground`, `bg-[hsl(var(--…))]`). Pořadí určí návštěvnost obrazovek.
- Kontrast: rozšířit stávající `student-dashboard-contrast.test.ts` na test, který projde každou náladu × každou dvojici přechodu dlaždic (bílý text ≥ 4,6:1) a texty na pozadí (≥ 4,5:1).

### Návrh palet (etapa 1, hodnoty doladím při implementaci podle testu)
- **Bezli:** dnešní hodnoty.
- **Minimal:** pozadí off-white ~#FAFAF7, text ~#111, primární téměř černá ~#1F1F1F, šedé tóny; dlaždice v přechodech břidlicové a grafitové šedi (např. #2E2E2E→#4A4A4A).
- **Natural:** krémové pozadí ~#F6F1E7, primární tmavá šalvěj/zelená ~#3F5E45, hnědý akcent ~#6B4E35; dlaždice olivová, mechová, hnědá a terakotová, ztmavené kvůli kontrastu 4,6:1.

## 3. Databáze a nastavení (SQL jen popis, nespouštět)

```sql
ALTER TABLE public.profiles
  ADD COLUMN mood text NOT NULL DEFAULT 'bezli'
  CHECK (mood IN ('bezli','minimal','natural'));
```
- Další nálady pak přidá jen změna CHECK. Případně lze použít volný text s validací v kódu.
- RLS: `profiles` už má politiky pro úpravu vlastního řádku. Před migrací ověřím, že update vlastního řádku nedovolí měnit citlivé sloupce (role/status). Pokud je ochrana řešená triggerem, `mood` se jen přidá na seznam povolených sloupců. Bez nové politiky.
- **Demo:** `demo_guard_*` jsou RESTRICTIVE. Je potřeba rozhodnout, jestli demo účet smí náladu uložit do profilu. Doporučení: demo jen localStorage, bez zápisu do DB, takže se ochrana dema nemění.
- **Rodič, lektor, správce školy, dálkový učitel:** všichni mají řádek v `profiles` a používají `ProfilePage`, takže stačí jedno místo.
- **Umístění:** `ProfilePage.tsx` má sekci přístupnosti (`useAccessibilitySettings`). Hned vedle přibude sekce **„Vzhled“**: tři náhledové karty (mini dlaždice + tlačítko), výběr přes radio (klávesnice, ARIA) a okamžitý náhled.

## 4. Co se nemění
Logo, stavové barvy (úspěch, chyba, varování, termín, stavy úloh), barvy odpovědí v živé hře (`mcq-option-visuals`), motivy prezentací a her, projekce, avatary, barvy předmětů a kolegů, paleta editoru, tisk a export pracovních listů, PDF/PPTX/HTML exporty, přihlašovací kartičky, e-maily. Všechny zůstávají v základní paletě Bezli. Projektor a `/hra` se řídí motivem prezentace, ne náladou.

## 5. Etapy

| Etapa | Obsah | Rozsah |
|---|---|---|
| 0 | Tokenová vrstva + `data-mood` + test kontrastu a neměnnosti stavových barev, jen localStorage, bez DB | S |
| 1 | Palety Minimal a Natural včetně 25 sad dlaždic, sekce Vzhled v profilu | S–M |
| 2 | Sloupec `profiles.mood` (po schválení SQL), synchronizace mezi zařízeními | S |
| 3 | Úklid pevných barev v UI podle priority: přehledy, Úlohy, Kontrola, Učím se, Učebnice, Portfolio, notifikace, Zeď, kalendáře, admin/editory | L (po částech) |
| 4 | Tmavé varianty nálad (dnes tmavý režim chybí) | M |
| 5 | Další nálady (Cute, Ocean, Plum, Sunny, Calm) | S každá |

Rozumné zadat jako jeden prompt: etapy 0 + 1. Etapa 2 čeká na schválení SQL.

## Rizika
- Do etapy 3 zůstanou na části obrazovek pevné fialové nebo modré prvky. V Minimal to bude nejvíc vidět.
- Minimal vypadá velmi podobně jako stavové šedé prvky a hrozí ztráta hierarchie. Pomůže jasný akcent (černá) a zachovat stavové barvy syté.
- Natural: zelená primární barva splývá se „správně/úspěch“. Primární šalvěj musí být výrazně tmavší nebo modrozelenější než `--success`.
- Problik výchozí barvy při načtení: řeší synchronní skript v `index.html`.
- Sdílený počítač ve třídě: nálada z localStorage předchozího uživatele. Při přihlášení se má přepsat hodnotou z profilu, při odhlášení vrátit na Bezli.
- Kontrast: každá nová paleta musí projít automatickým testem, ruční kontrola nestačí.

## Otázky pro Tynu
1. Smí demo účet náladu jen v prohlížeči, bez uložení do profilu? (ano/ne)
2. Má se náhled žákovi zobrazit jen v profilu, ne na přehledu? (ano/ne)
3. Stačí v etapě 1 jen světlé varianty, když tmavý režim dnes v aplikaci chybí? (ano/ne)
4. Má škola (správce) moct určit výchozí náladu pro své uživatele? (ano/ne, zatím navrhuji ne)
