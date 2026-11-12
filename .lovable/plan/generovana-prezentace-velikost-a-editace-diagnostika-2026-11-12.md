# Generovaná prezentace z učebnice – velikost písma a editace (diagnostika, 12. 11. 2026)

Pouze analýza. Žádný kód, migrace ani nasazení.

## 1) Jak prezentace vzniká a kde je uložená
- `src/hooks/usePresentationLauncher.ts` → `buildSlidesForLesson(lesson)`:
  - `blocksToSlides(lesson.blocks, title, { heroImageUrl })` (`src/lib/blocks-to-slides.ts`) generuje snímky **za běhu** z bloků lekce.
  - Načte učitelovu propojenou verzi z `teacher_presentations` (`teacher_id` + `source_lesson_id`, sloupec `slides` jsonb; záloha `lesson.presentation_slides`).
  - `mergePresentationSlides(fresh, saved)` (`src/lib/presentation-merge.ts`) sloučí: obsah z lekce vyhrává, ruční vzhled (`fontScale`, layout, téma, poznámky, pozadí) zůstává; `lockedFromLesson` = snímek se neaktualizuje; `structureEditedByTeacher`, `deletedSourceBlockIds`; ručně přidané snímky se připojí na konec.
- `openEditor` → `PresentationEditorDialog` (stejný editor jako běžné prezentace), ukládání `savePresentationRow` do `teacher_presentations`.
- Spuštění: `launchLiveSession` vloží hotové snímky do `game_sessions.activity_data` (snapshot; dál se z lekce negeneruje).
- `src/pages/TeacherPresentations.tsx` `openEditor`: propojenou prezentaci (`lesson_id`/`source_lesson_id`) **odmítne** („upravíte v editoru lekce“). Volba „Uložit jako moji prezentaci“ (kopie bez vazby) **neexistuje**.

## 2) Proč je text malý
- `SlideCanvas.tsx` (≈ ř. 1845): `flowScale = max(READABLE_SCALE_FLOOR, availH/contentH)` → přetékající snímek se zmenší až na **72 %** (`READABLE_SCALE_FLOOR = 0.72`, `blocks-to-slides.ts`).
- Generátor dělí až nad `HARD_MAX_CHARS_PER_SLIDE` = 900/0,72 ≈ **1250 znaků** a 5 bloků (`MAX_BLOCKS_PER_SLIDE`); dělení počítá znaky, ne skutečnou výšku (obrázky, tabulky, nadpisy) → reálně se často zmenšuje.
- `projector.fontScale` (CSS `zoom` na skupině bloků) – jen per snímek v editoru (`PresentationEditorDialog` ř. ~880, posuvník), během projekce nedostupné.
- Projektor `LiveProjectorScreen.tsx` má tlačítka Zmenšit/Zvětšit = `userZoom` 100–150 % po 10 (`presentation-routes.ts`, `loadProjectorZoom`, localStorage **jen v daném prohlížeči**). Zvětšuje celé plátno (`ProjectorSlideView` `userZoom`), takže přetékající obsah se ořízne/zmenší – nejde o velikost písma. `LiveTeacherScreen.tsx` ovládání nemá. Žákovské zařízení (`StudentGamePlay`) nastavení nesdílí.

## 3) Nejmenší bezpečné řešení
(i) **A+/A− v projekci**: na `LiveTeacherScreen` + `LiveProjectorScreen` měnit násobič písma (např. 80–160 %) uložený u učitele (localStorage `bezli.projectorFontScale`, bez DB); do projektoru přenést přes `game_sessions.settings.projectorFontScale` (stávající sloupec, stejně jako `projectorScrollTop`). Násobí se s `projector.fontScale`. Žáci beze změny.
(ii) **Minimum**: zvednout podlahu `flowScale` (např. 0,85) jen tehdy, když generátor rozdělí podle výšky; v `splitSlide` přidat váhu obrázků/tabulek. Měření výšky v prohlížeči → jen při otevření editoru/spuštění (ne v datech). Při A+ nad podlahu raději posuvné zobrazení (`projectorScrollTop` už existuje) než další zmenšení – dělení snímků za běhu by posunulo indexy živé relace (viz 4).
(iii) **„Upravit snímek“ v projekci**: použít existující koncepty `live_session_drafts` + `LiveDraftsPanel` + `publish_live_draft` (atomické, projektor koncept nevidí) – přidat „upravit aktuální snímek“ jako koncept, který nahradí snímek po publikaci; zároveň zapsat úpravu do `teacher_presentations` s `lockedFromLesson: true` pro příští hodiny. Nahrazení snímku na místě může vyžadovat rozšíření RPC (dnes jen vkládání za aktuální) → DB krok jen po „schvaluji“.
(iv) **„Uložit jako moji prezentaci“**: v `TeacherPresentations`/editoru vložit novou řádku `teacher_presentations` s kopií sloučených snímků, `lesson_id`/`source_lesson_id = null` (stávající RLS vlastníka, bez migrace) → plná editace v `PresentationEditorDialog`.
**Ochrana před přegenerováním**: kopie (iv) nemá vazbu → nikdy se nepřegeneruje; v propojené verzi každý ručně upravený snímek automaticky `lockedFromLesson: true` (případně `structureEditedByTeacher`), plus štítek „ručně upraveno“ a tlačítko „Obnovit z učebnice“.

## 4) Rizika pro živou relaci
- `game_sessions.activity_data` je snapshot; `current_question_index`, `settings` (`armedQuestion`, `activityStartMode`), odpovědi a hodnocení se váží na **index** snímku. Vložení/rozdělení/smazání před aktuálním snímkem posune indexy → špatné odpovědi/body. Proto: úprava jen nahrazuje snímek na stejném indexu, nikdy nemění počet před aktuálním.
- Úprava aktivitního snímku (otázky, správné odpovědi) za běhu, když žáci odpovídají, by rozbila serverové bodování (`_shared/game-scoring.ts`) → editaci aktivit během hry zakázat (jen texty/obsahové snímky), nebo jen pro snímky po aktuálním.
- Projektor a žáci čtou realtime; větší změna `activity_data` = resync (`realtime-resilience`). Expanze aktivit (`live-game-expand.ts`) musí proběhnout i pro upravený snímek.
- Demo: zápisy do `teacher_presentations`/konceptů podléhají `demo_guard`/`demo_iso` – nic neobcházet.

## Kroky
1. **A+/A− a čitelnost** (jen frontend): ovládání na učitelské i projektorové obrazovce, `settings.projectorFontScale`, výška-vážené dělení v `blocks-to-slides.ts`, testy. ~1 den.
2. **„Uložit jako moji prezentaci“** (jen frontend, bez DB): kopie bez vazby, otevření v editoru, automatický `lockedFromLesson` u upravených snímků + „Obnovit z učebnice“, testy merge. ~0,5–1 den.
3. **„Upravit snímek“ během projekce**: přes koncepty; pokud potřeba nahrazení na místě → nejdřív diagnostika RPC `publish_live_draft` a SQL ke schválení. ~1–2 dny.
