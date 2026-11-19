# Studio – aktivity a hry (návrh, 19. 11. 2026)

Jen návrh. Bez kódu, DB, migrací a nasazení. Etapa 0 = plán `.lovable/plan/jednotny-vstup-zdroju-2026-11-19.md` (balík zdrojů, limity, odkaz, demo); zde se neopakuje. Po schválení se tento dokument uloží také jako `.lovable/plan/studio-aktivit-2026-11-19.md`.

## Otázka pro Tynu jednou větou
„Když je ve hře třeba křížovka, kterou nejde soutěžit na rychlost, má ji každý žák řešit na svém telefonu s odpočtem a body se mu přičtou do hry (samostatné kolo)? Nebo ji raději ze živé hry vynechat a dát jen za domácí úkol?“

## A) Inventář typů (ověřeno v kódu)

Zdroje: `live-game-core.ts:10`, `activity-wizard.ts:31`, `ActivityBlock.tsx`, `worksheet-spec.ts:16`, `AddSlideSheet.tsx:675–691`.

| Typ | Blok lekce | Slide hry | Položka listu | Šablona (Moje aktivity) | Živě dnes | Samostatně | Tisk |
|---|---|---|---|---|---|---|---|
| Kvíz (MCQ) | quiz | mcq | mcq | ano | ano | ano | ano |
| Pravda/nepravda | true_false | → mcq | true_false | ano | ano (jako MCQ) | ano | ano |
| Přiřazování | matching | → rozpad na MCQ | matching | ano | jen rozpadem | ano | ano |
| Řazení | ordering | → MCQ | ordering | ano | jen rozpadem | ano | ano |
| Doplňování | fill_blanks / fill_choice | → MCQ | fill_blank | ano | jen rozpadem | ano | ano |
| Popis obrázku | image_label, image_hotspot | – | image_label, image_hotspot | ano | ne | ano | ano |
| Kartičky | flashcards | – | flashcards | ano | ne | ano | ano |
| Křížovka | crossword | – | crossword | jen v lekci | ne | ano | ano |
| Osmisměrka | – | – | word_search | **jen list** | ne | ne | ano |
| Třídění | sorting | – | sorting | jen v lekci | ne | ano | ano |
| Pexeso | memory_game | – | – | jen lekce | ne | ano | ne |
| Odkrývací karty | reveal_cards | – | – | jen lekce | ne | ano | ne |
| Anketa | poll | (wordcloud/wall) | – | – | ano bez bodů | – | – |
| Zeď / slovní mrak / exit ticket | wall | wall, wordcloud, exit | open_answer | „Otevřená odpověď“ | ano bez bodů | – | částečně |
| Krátká odpověď | – | – | short_answer | **jen list** | ne | ne | ano |
| Úniková hra, diferencovaná, týmy | – | escape, differentiated, teams | – | **jen hra** | ano | ne | ne |
| Text / Shrnutí / Tabulka | text, summary | text | instruction_box, table | summary | jako slide | ano | ano |

**Nesoulady**
- Čas, body a vysvětlení mají jen slidy hry (`game-slide-settings`, `timeLimitSec`); aktivity z Moje aktivity je nemají.
- Obrázek u otázky/odpovědi: hra MCQ má, aktivity v lekci jen u image_label/hotspot.
- Živá hra vše převádí na MCQ (`activityToCoreQuestions`) – přiřazování a řazení ztrácí původní mechaniku; ostatní typy „nelze hrát živě“.
- „Aktivita z vlastního textu“ (`AddSlideSheet.tsx:462`) posílá jen text (server ořízne `slice(0,4000)`), vytvoří **jednu** MCQ. Má přihlášení i demo guard, model `gemini-3-flash-preview`.
- Osmisměrka a krátká odpověď existují jen v listu; úniková hra a týmy jen ve hře.

## B) Společný model kroku

```text
ActivityStep {
  id, type,                    // quiz | true_false | matching | ... | text | wall | escape ...
  title, instructions?,
  content,                     // typově specifická data = dnešní activitySpec/props
  media?: { questionImage?, answerImages? },
  explanation?, hint?,
  settings: { timeLimitSec?, points?, shuffle?, mode?: "live"|"solo_round"|"self" },
  ai?: { generated, modifiedAt }
}
ActivitySet { id, title, purpose?, gameMode?, background?, teams?, steps: ActivityStep[], publish? }
```

Adaptéry (čisté funkce, `src/lib/activity-step/`), oba směry, s testy „tam a zpět beze ztráty“:
- `fromGameSlide / toGameSlide` (teacher_game_templates.activity_data),
- `fromLessonBlock / toLessonBlock` (bloky lekcí, activity_templates),
- `toWorksheetItem` (jednosměrně, list je tiskový výstup; zpět jen pro shodné typy),
- neznámé pole se uchovají v `content._extra`, aby se nic neztratilo.

Doplnit u všech typů: `timeLimitSec` (výchozí z `live-timing.ts`), `points` (výchozí 1000 standard; skutečné bodování dál jen server `_shared/game-scoring.ts`), `explanation`, volitelný obrázek. V první fázi uloženo uvnitř stávajících JSON polí, bez změny DB.

## C) Studio UX

```text
Studio (aktivity a hry)
 ├ Knihovna sad: hledání, filtr (hry / aktivity / šablony / sdílené), karty
 ├ + Nová sada → Z mého materiálu | Z lekce | Od nuly | Ze šablony
 └ Sestavovač
    [Seznam kroků – drag&drop, ↑↓]  [Náhled: Projekce | Telefon žáka, úpravy přímo]  [Nastavení kroku / sady]
    Horní lišta: Zpět/Znovu · Koncept uložen · Zkušební běh jako žák · Použít ▾
    Použít: Spustit živě · Zadat jako úkol · Vytisknout · Do prezentace · Do lekce
    Kontrolní seznam: „Chybí správná odpověď u kroku 3“, „Krok 5 nejde živě – bude samostatné kolo“
```
- „Přidat krok“: hledání + skupiny (Otázky, Přiřazování a řazení, Slova a doplňování, Obrázky, Hry a kola, Názor třídy, Obsah).
- 390 px: tři panely jako záložky (Kroky / Náhled / Nastavení), lišta dole.
- Komponenty: `StudioLibrary`, `SetBuilder`, `StepList`, `StepPreview` (znovupoužije existující přehrávače a `InlineText`), `StepSettingsPanel`, `AddStepPicker`, `SetChecklist`, `useSetDraft` (autosave + undo jako `useSlidesHistory`).
- Stávající editory (GameTemplateEditorDialog, ActivityBlock) se vloží jako panel nastavení – nepíšou se znovu.

## D) AI
- „Navrhnout sadu“: balík zdrojů → 1 volání → návrh 5–12 kroků smíšených typů; učitel zaškrtne/upraví, vloží až po potvrzení.
- „Jeden typ“: zachová dnešní průvodce (obtížnost, počet, možnosti, banka slov).
- „Přegenerovat krok“ a „Upravit pomocí AI“: 1 volání na krok, ostatní kroky se nemění.
- Model: sjednotit na aktuální flash model (rozhodnutí o `gemini-2.5-flash` stále čeká); normalizace jen v `activity-ai-normalize.ts`.
- Demo: 1 generování = 1 volání přes `demoAiGuard`; upozornění na zbývající volání.
- Každý AI krok má `ai_generated` + `AiContentBadge`, ruční úprava nastaví `ai_modified_at`.

## E) Zveřejnění žákům (návrh, DB až po „schvaluji“)
- Bez nové tabulky v 1. fázi: zveřejnění = **materiál** přes stávající `assignments` (`settings.kind = material`, `settings.activitySet`, `visibleUntil`, příjemci přes `assignment_recipients`). Stavy: Soukromé → Naplánováno (publish_at) → Zveřejněno → Staženo (archivace). RLS beze změny.
- Žák ji najde v Úkolech/materiálech třídy a v „Učím se“ jako „Procvičit sadu“.
- Ukládá se jen výsledek do existujícího `student_activity_results` (skóre, odpovědi pro učitele); bez XP mimo `add_xp`. Domácí procvičování nemá žebříček.
- Pozdější varianta (etapa 7): tabulka `activity_set_publications` – jen pokud materiál nestačí.

## Samostatné kolo – zhodnocení
- Výchozí návrh je dobrý: zachová tempo hry, používá stávající časování (`live-timing`, ruční „Spustit“). Body: podíl správných × body kroku, počítá server.
- Alternativy: (a) krok se ve hře přeskočí a nabídne jako domácí úkol; (b) projekce jen ukáže úlohu a třída řeší společně bez bodů; (c) týmové kolo – jeden telefon na tým.
- Riziko: server musí umět hodnotit nové typy – to je etapa 5 a nejcitlivější část.

## F) Etapy

| # | Rozsah | Rizika | Testy / regrese | Náročnost |
|---|---|---|---|---|
| 0 | Jednotný vstup zdrojů (samostatný plán) | viz plán | viz plán | M–L |
| 1 | Aktivita z vlastního textu: zdroje, víc kroků a typů; výběr lekce v Moje aktivity | změna serverové funkce | nové + `live-game-core`, `live-game-expand`, `game-scoring` | M |
| 2 | ActivityStep + adaptéry, čas/body/vysvětlení/obrázek všude | ztráta polí | round-trip testy všech typů, `lesson-to-slides-fidelity`, `lesson-activity-to-worksheet` | L |
| 3 | Sestavovač za příznakem (jen Tyna) | výkon, mobil | e2e uložení/načtení, 390 px | L |
| 4 | Menu Studio, knihovna, přesměrování `/ucitel/hry`, `/aktivity` | zlomené odkazy | test tras, staré odkazy fungují | M |
| 5 | Živé hraní všech typů (samostatná kola, server bodování) | férovost, výkon | `game-scoring`, `game-session-sync`, `live-timing`, zátěž 50 hráčů | L |
| 6 | Zveřejnění žákům přes materiály | soukromí, viditelnost | recipients/RLS testy, demo izolace | M |
| 7 | Úklid, případná společná tabulka (migrace po schválení) | data | migrace + rollback, zpětná čitelnost | M |

Každá etapa se nasazuje samostatně; regrese živé hry vždy: celá sada testů + ruční hra se 2 telefony (PIN bez účtu, režimy Klasický/Závod/Věž/Krádež, týmy, projekce).

## G) Etapa 1 – implementační plán
1. `generate-activity-from-text`: nový volitelný vstup `{ text, types?: ["mcq","true_false",...], count?: 1–10 }`; bez `types` vrací dnešní tvar (zpětná kompatibilita). Odstranit tichý `slice(0,4000)` → odmítnout >limit chybou 413 s hláškou. Zachovat requireAuth + demoAiGuard (1 volání).
2. `AddSlideSheet` (fromtext): místo samotného textového pole `SourceInput` z etapy 0 (text, soubory, foto, odkaz); výběr počtu (1–10) a typů (Kvíz, Pravda/nepravda, Slovní mrak/Zeď jako otázka bez bodů); náhled návrhu se zaškrtáváním, vložení přes stávající `appendMany` + `buildMcqSlide`, nic nenahradí existující slidy.
3. Nový čistý `src/lib/fromtext-slides.ts`: normalizace AI výstupu → slidy (přes `activity-ai-normalize.ts`), označení AI.
4. `ActivityWizardDialog`: zdroj „Z lekce“ přes existující `teacher-source-lessons` picker (jako CreateFromLessonDialog); odstranit tiché `limitSourceText` → viditelné upozornění.
5. Testy: `fromtext-slides.test.ts` (3 typy, neplatný výstup odmítnut, pořadí), test zpětné kompatibility funkce (mock), `activity-wizard` (žádné tiché ořezání), regrese `live-game-core`, `live-game-expand`, `game-scoring`.
- Nasaditelné samostatně: **ano**, pokud je hotová etapa 0 (jinak verze 1a jen s textem a více kroky). Edge funkci nasazuje Tyna na pokyn.

## H) Rizika, otázky, neověřitelné
**Rizika:** bodování nových typů na serveru; velký zásah do AddSlideSheet (1600+ řádků); dvě knihovny během přechodu; demo limit při „Navrhnout sadu“.

**Otázky na Tynu**
1. Samostatné kolo jako výchozí pro nehratelné typy? (ano/ne)
2. Zveřejnění žákům přes stávající Materiály (bez nové tabulky)? (ano/ne)
3. Etapa 1 až po etapě 0, nebo nejdřív rychlá verze jen s textem? (po 0 / rychlá)
4. Model AI: ponechat `gemini-2.5-flash`, nebo přejít na novější flash? (ponechat / přejít)
5. Mají žáci při domácím procvičování vidět body a správné odpovědi hned? (ano/ne)

**Bez živého testu nelze ověřit:** skutečné AI výstupy a jejich kvalitu, zátěž 50 hráčů v samostatném kole, chování na skutečných telefonech (galerie, HEIC), čitelnost na projektoru.

## Technické poznámky
- Bez změny DB v etapách 0–5; etapa 6 bez migrace, etapa 7 jen po „schvaluji“.
- Zachovat: `live-game-core.ts` jako jediný převod, `_shared/game-scoring.ts`, `live-timing.ts`, demo_iso/demo_guard, `assignment_recipients`.
