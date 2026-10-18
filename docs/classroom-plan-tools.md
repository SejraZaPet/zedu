# Nástroje přímo v plánu hodiny

## Hotovo
- Šest sdílených nástrojů v editoru, náhledu uloženého plánu a učitelském panelu časování při živé prezentaci.
- „Spustit odpočet“ převezme čas fáze a ihned běží; prázdný nebo neplatný čas tlačítko nepovolí.
- Losování a skupiny předvyberou připojenou třídu/skupinu pouze z již oprávněných možností.
- Okno zůstává nad plánem, zavírá se křížkem nebo Escape; neukládá plán ani jména.
- Sdílená lišta je rozšiřitelná bez nefunkčního tlačítka hlasování.
- Etapa B neimplementována; žádná migrace, změna oprávnění, generování, ukládání nebo rozvrhu.

## Soubory
- `src/pages/TeacherLessonPlanEditor.tsx`: lišta, odpočty a překryv v editoru i náhledu.
- `src/components/live/LessonPlanPacing.tsx`: stejné nástroje v učitelském časování; stávající mapování fází beze změny.
- `src/components/classroom/ClassroomToolsOverlay.tsx`: společné okno, bezpečné zavírání a zachování celé obrazovky pod ním.
- `src/components/classroom/PhaseCountdownButton.tsx`: společné spuštění odpočtu fáze.
- `src/test/classroom-tools.test.ts` a `src/test/classroom-plan-tools.test.tsx`: čas fáze, oprávněný předvýběr, automatický start, neuložený text a vlastnictví celé obrazovky.
- Příprava z předchozího kroku: `ClockTools.tsx`, `PeopleTools.tsx`, `useClassroomClock.ts`, `classroom-tools.ts`, `TeacherClassroomTools.tsx`.
- `AGENTS.md` a `roadmap.md`: sdílená struktura a stav úkolu.

## Ověření
- Všech 537 testů ve 112 souborech prošlo; kontrola sestavení OK.
- Přihlášená učitelka: nový rozepsaný plán, všechny nástroje, automatický dvouminutový odpočet, Escape, celá obrazovka a zachování textu/času bez uložení.
- Existující uložený plán: otevření a zavření nástroje v náhledu bez zápisu.
- Telefon 390 × 844: lišta i odpočet čitelné bez vlastního vodorovného přesahu; žádné chyby běhu.
- Celý původní editor má na telefonu přesah mimo nové nástroje; tento malý úkol jeho ostatní rozložení neměnil.
- Nová cesta v učitelském panelu živé prezentace a předvýběr skutečné připojené skupiny nebyly v prohlížeči end-to-end vyzkoušeny; čistá pravidla předvýběru jsou otestována.
- Žádný testovací plán nebyl uložen, žádná data nebyla smazána.

## Ručně vyzkoušejte
1. V plánu změňte text bez uložení, spusťte odpočet fáze, zavřete Escape a ověřte text i místo návratu.
2. V plánu své třídy a skupiny otevřete Losování/Skupiny a zkontrolujte předvýběr.
3. Na telefonu a skutečném projektoru ověřte šest nástrojů, koncový zvuk a povolení/odmítnutí mikrofonu.
4. Při živé prezentaci propojené s plánem vyzkoušejte lištu v učitelském časování i návrat z celé obrazovky; projektor na jiném zařízení tento lokální překryv nevidí.

## Rollback
V historii Lovable vraťte změny tohoto úkolu a jeho předchozí přípravy, nikoli dokončenou Etapu A; alternativně odeberte importy, stav a použití nástrojů v TeacherLessonPlanEditor a LessonPlanPacing a vraťte sdílené soubory do stavu před přípravou integrace. Databázový rollback není potřeba, protože databáze ani uložené plány nebyly měněny. Etapa B nadále čeká na výslovné schválení.