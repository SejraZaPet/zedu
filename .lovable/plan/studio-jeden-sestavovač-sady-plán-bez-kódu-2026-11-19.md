# Studio: jeden sestavovač sady (plán, bez kódu)

Stav ověřený v kódu 19. 11. 2026. Nic se nenasazuje; v 1. fázi žádná migrace dat.

## 1. Co je dnes (ověřeno)

- „+ Nová sada“ (StudioPage.tsx:87-104) má 4 cesty a každá vede do jiného editoru:
  - **Z mého materiálu**: FromSourceActivityPanel. Umí jen 4 typy kroků (`mcq, true_false, open, explain`, fromtext-slides.ts:8). U každého kroku jde nastavit čas a body.
  - **Z lekce**: QuickGameDialog. Umí jen kvíz, pravda/nepravda a přiřazování.
  - **Od nuly**: GameTemplateEditorDialog. Má herní režim, týmy a snímky. U snímku nejde přímo nastavit čas ani body (přidávání snímků přes AddSlideSheet).
  - **Ze šablony**: jen přepne záložku a nic nevytvoří. Je to chyba.
- Průvodce aktivitou (ActivityWizardDialog) má 4 kroky: zdroj → nastavení → náhled → použít. Vždy ale vytvoří jen jednu aktivitu jednoho typu.
- Existují tři oddělené světy:
  - živá hra (`teacher_game_templates.activity_data`, snímky),
  - aktivita v lekci (bloky lekce, `activity_templates`),
  - tisk (activity-pdf-export, pracovní listy).

## 2. Tabulka typů (ověřeno v kódu)

Legenda:
- **Ano**: funguje přímo.
- **Převod**: do živé hry se dnes převádí na otázky s výběrem odpovědi (live-game-core.ts:10-38).
- **Globálně**: týmy a časovač platí z nastavení celé živé hry, typ sám týmovou mechaniku nemá.
- **—**: neumí.

| Typ | Živě | Samostatně (lekce) | Tisk | Tým / časovač |
|---|---|---|---|---|
| Kvíz | Ano | Ano | Ano | Globálně |
| Pravda/nepravda | Převod | Ano | Ano | Globálně po převodu |
| Přiřazování | Převod | Ano | Ano | Globálně po převodu |
| Řazení | Převod | Ano | Ano | Globálně po převodu |
| Doplňování / výběr | Převod | Ano | Ano | Globálně po převodu |
| Popis obrázku | — | Ano | Ano | — |
| Hotspot | — | Ano | Ano | — |
| Kartičky | — | Ano | Ano | — |
| Křížovka | — | Ano | Ano | — |
| Osmisměrka | — | — | Jen pracovní list | — |
| Třídění | — | Ano | Ano | — |
| Pexeso | — | Ano | Ano | — |
| Odkrývací karty | — | Ano | Ano | — |
| Zeď (a exit ticket a BezliStart, které ji používají) | Ano | Ano (odevzdání se jen zaloguje) | Ano | Globálně |
| Mrak slov | Ano | — | — | Globálně |
| Anketa | Ano | — | Ano | Globálně |
| Krátká odpověď | — | — | Jen pracovní list | — |
| Týmy / Diferencovaná / Úniková hra | Ano | — | — | Vlastní týmová logika |
| Text / výklad / shrnutí | Zobrazení | Zobrazení | — | Bez bodů |

Jak zaplnit mezery:
- **Typy jen „Samostatně“** (popis obrázku, hotspot, kartičky, křížovka, třídění, pexeso, odkrývací karty): ve 3. etapě dostanou **samostatné kolo** v živé hře. Projektor ukáže „Pracujte na telefonu“, telefon zobrazí stávajícího hráče aktivity z lekce a výsledek se pošle jako jedna odpověď (správně/body podle `points`). Do té doby mají viditelný štítek „Zatím jen samostatně/tisk“ a ze živého spuštění se vynechají s upozorněním.
- **Osmisměrka a krátká odpověď**: zatím jen tisk přes pracovní list. Samostatného hráče navrhnu zvlášť, není v této sadě etap.
- **Mrak slov, anketa, týmy, úniková hra**: jen živě. V lekci ani tisku je nenabízíme a ukážeme štítek „Jen živě“.

## 3. Herní režimy (ověřeno v kódu a testech)

Všechny čtyři skutečně fungují. Body počítá server (`_shared/game-scoring.ts:6-104`) a testy pokrývají vzorce, kradení i vyloučení spoluhráčů (game-scoring.test.ts, game-session-sync.test.ts).

| Režim | Popis pro učitele (1 věta) | Co dělá v kódu |
|---|---|---|
| Klasický kvíz | Všichni odpovídají naráz a za správnou a rychlou odpověď získají víc bodů. | 400–1000 bodů podle rychlosti, za špatnou odpověď 0. |
| Závod | Každý postupuje svým tempem a za správnou odpověď posune svou postavu na dráze. | +10 bodů za správnou odpověď, žák postupuje sám, na projektoru se ukáže dráha. Platí pro celou hru, u jednotlivého snímku ho nejde změnit. |
| Stavění věže | Za každou správnou odpověď přibude patro věže. | +1 za správnou, 0 za špatnou, na projektoru věž. |
| Krádež bodů | Správná odpověď ukradne body vedoucímu hráči, špatná body ubere. | Správná: +100 a 10 % od vedoucího (50–300), tři správné za sebou kradení zdvojnásobí. Špatná: −100, nejvýš do nuly. Nekrade se spoluhráčům. |

Přiznávám výslovně:
- Vizuální stránku režimů (dráha, věž, kradení) ověřují testy jen částečně. Na obou projekčních obrazovkách ji nikdo neprošel naživo.
- Body 0/1/2 jsou u kroku jen násobek. U Krádeže bodů se neuplatní.
- „Klasický“ je v kódu `standard`; neznámá hodnota se tiše přepne na něj.

## 4. Jeden sestavovač sady

Nová komponenta **StudioSetBuilder** (celoobrazovkový dialog, mobil 390 px) postavená na stejném 4krokovém rozvržení jako ActivityWizardDialog:

```text
1 Zdroj  →  2 Kroky  →  3 Náhled  →  4 Použít
```

1. **Zdroj** se liší jen výchozím obsahem:
   - Od nuly: prázdná sada.
   - Ze šablony: výběr z knihovny her (včetně demo šablon) a uložených šablon aktivit. Nahradí dnešní nefunkční přepnutí záložky.
   - Z mého materiálu: SourceInput, tedy text, soubory, fotky nebo odkaz, a AI návrh.
   - Z lekce: výběr lekce přes teacher-source-lessons a AI návrh.
2. **Kroky**: seznam kroků sady. U každého je možné změnit pořadí (šipky, klávesnice), smazat a upravit.
   - **„+ Přidat krok“** otevře mřížku všech typů z tabulky. Typy jsou ve skupinách Kvízy / Procvičování / Text / Obrázky / Živě se třídou a každý má štítky Živě / Samostatně / Tisk.
   - Obsah kroku se edituje znovupoužitými editory: editor bloku aktivity z lekce (ActivityBlock), editory snímků z AddSlideSheet pro zeď, mrak, anketu, týmy a únikovou hru, a editory kroků z FromSourceActivityPanel.
   - **Společná nastavení u každého kroku** (stejný panel pro všechny typy):
     - čas na krok: přepínač „bez limitu“ nebo 5–600 s (zapisuje se do `activitySpec.timeLimitSec`),
     - body: 0 / 1 / 2,
     - vysvětlení a obrázek,
     - „jednotlivě / v týmech“.
   - Týmy jsou nastavení celé sady (dnešní `default_team_mode`). U kroku jde jen vypnout „v týmech“, tedy tento krok jednotlivě. U typů, které živě nejdou, je volba nedostupná a vysvětlená.
   - Nahoře je nastavení sady: název, předmět, herní režim s popisem jednou větou a týmy (počet 2–6).
3. **Náhled**: projde kroky tak, jak je uvidí žák. Jsou tu přehledné štítky, co se živě vynechá.
4. **Použít**: Uložit do Studia, Spustit živě (PIN a připojení bez účtu beze změny), Vložit do lekce, Vytisknout, Uložit jako šablonu.

Co zůstává beze změny: GameTemplateEditorDialog (pro úpravu starých her), ActivityWizardDialog v katalogu, AddSlideSheet v živých prezentacích, PIN, projekce, týmy, šablony a tisk.

AI „Z mého materiálu“: výběr typů bude z celého katalogu. Server dostane rozšířený seznam typů a výstup se normalizuje přes `activity-ai-normalize.ts`. Nepoužitelné kroky se viditelně zahodí s hláškou, nic se neztratí potichu. Modely jen ze sdílené konstanty `_shared/ai-models.ts`.

## 5. Datový model (bez migrace)

- Sada se ukládá jako dnes do `teacher_game_templates`: `activity_data` = snímky a nastavení sady ve stávajících sloupcích.
- Nový modul `src/lib/studio-step.ts`:
  - typ `ActivityStep` a adaptéry krok ↔ snímek hry a krok ↔ blok lekce podle plánu etapy 2,
  - neznámé vlastnosti se uchovají v `_extra`.
- Kroky, které živě nejdou, se uloží jako snímek `{ type: "studio_step", activityType, props }`. Před živým spuštěním je odfiltruje klientský adaptér, takže se nemění herní logika (live-game-core, game-scoring, live-timing). První úkol 1. etapy: ověřit v kódu, jak dnes spuštění a projektor zacházejí s neznámým typem snímku. Pokud by je nepřeskočily, filtruje se při spuštění.

## 6. Etapy (každá použitelná sama)

**Etapa 1: Sestavovač a všechny typy**
- StudioSetBuilder se 4 kroky.
- Všechny 4 cesty „+ Nová sada“ vedou do něj. „Ze šablony“ funguje.
- „Přidat krok“ nabízí celý katalog a AI navrhuje z celého rozsahu.
- Společný panel čas / body / vysvětlení / obrázek.
- Herní režimy mají popisy jednou větou (i v GameTemplateEditorDialog).
- Živé spuštění vynechá kroky, které živě nejdou, a ukáže, které to jsou.
- Testy adaptérů krok ↔ snímek a krok ↔ blok (oba směry).

**Etapa 2: Použít odkudkoliv**
- Vložení celé sady do lekce (kroky jako bloky) a tisk celé sady (activity-pdf-export po krocích).
- Úprava starých her v novém sestavovači; starý editor zůstane jako záloha.

**Etapa 3: Samostatné kolo v živé hře**
- Typy jen „Samostatně“ se hrají živě na telefonech jako jedno kolo s jedním výsledkem.
- Týká se odpovědí a herní logiky, proto je to samostatné schválení s plánem změn serveru.

**Mimo tento plán** (podle plánu etap 5–6): zveřejnění sad žákům, samostatný hráč pro osmisměrku a krátkou odpověď.

## 7. Rizika, testy, neověřitelné

Rizika:
- velký dialog na 390 px,
- AI vrací nepovedené tvary (zachytí normalizace),
- neznámý typ snímku u starých klientů,
- záměna nastavení týmů u sady a u kroku.

Testy (vitest):
- adaptéry v obou směrech,
- čas 0 = bez limitu,
- body 0/1/2,
- filtr kroků, které živě nejdou,
- „Ze šablony“ vytvoří sadu,
- popisy všech 4 režimů,
- normalizace AI pro každý typ,
- regrese live-game-core, live-game-expand, game-scoring, live-timing, game-session-sync.

Nelze ověřit bez živého testu:
- hra se 2 telefony a projektor (vizuály režimů, týmy),
- AI na ostré verzi,
- tisk na skutečné tiskárně.

## Technické poznámky

- Plán se po schválení uloží i jako `.lovable/plan/studio-sestavovac-2026-11-19.md`.
- Bez změn RLS, tabulek a edge funkcí pro hru. Rozšíří se jen typy v `generate-activity-from-text` a nic se nenasazuje.
