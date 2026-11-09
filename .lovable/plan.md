# Čas na odpověď a tlačítko „Spustit“ u živých aktivit – diagnostika a plán

## Co dnes platí
**Odkud je „20 s“ (jisté):** nejde o nastavení slidu. Je to záložní hodnota `timePerQuestion || 20`, která je ve kódu zapsaná na čtyřech místech:
- `StudentGamePlay.tsx` ř. 753 (odpočet žáka u klasických her),
- `TeacherGameScreen.tsx` ř. 22,
- serverová funkce `submit-answer` ř. 110,
- výchozí `GAME_RULES.classic.defaultTimeSec = 20` v `_shared/game-scoring.ts` (a `game-types.ts` ř. 80).

Čas se ukládá **jen pro celou hru** (`game_sessions.settings.timePerQuestion`):
- „Živá hra“ (`LiveGameButton`) má posuvník 5–60 s.
- Prezentace spuštěná přes `usePresentationLauncher` / `TeacherPresentations` má pevně 30 s.
- Prezentace přes serverovou funkci `create-live-session` má 0, tedy bez časovače. Kvůli záloze `|| 20` se ale klasická herní obrazovka i serverové bodování chovají, jako by bylo 20 s.

Pole na úrovni slidu (`slide.timeLimit`) existuje jen částečně. Bere ho v úvahu bodování (`game-scoring-apply.ts` ř. 19) a rozbalení kvízu (`live-game-expand.ts`). Odpočet (`McqCountdown`, `liveQuestionTimeLimitMs`) ani automatické odhalení výsledků v `LiveTeacherScreen` ho nečtou a v editoru se nedá nastavit. Proto se u slidů z lekce nepoužije.

**Spuštění (jisté):** samostatný stav „čeká na spuštění“ neexistuje. Odpovídání a odpočet začnou ve chvíli příchodu na slide, protože každý přechod (`nextQuestion`, `goToIndex`, AddSlideSheet) zapíše `question_started_at = now`. U kvízu (MCQ) se po vypršení limitu nebo po odpovědi všech výsledky odhalí samy. Zeď, anketa a oblak slov odpočet nemají, ale odpovídat jde také hned. Výjimka je tempo řízené žákem (`pacingMode: "student"`) a závod (race): každý žák jede svým tempem, takže tam ruční spuštění nedává smysl.

**Server (jisté):** odpověď po vypršení času neodmítne. Čas jen sníží body.

**Dříve řešeno:** etapa „Živý kvíz 1“ výslovně ponechala časy beze změny. Ukládání času na slidu ani tlačítko „Spustit“ zatím nikdo nezačal, nic tedy není rozbité ani rozdělané. Starší naplánovanou práci jsem v plánech podle hesel „časovač“ / „Spustit“ nenašla.

## Návrh po etapách

**Etapa 1 – čas na odpověď u slidu (bez DB):**
- V editoru slidu (PresentationEditorDialog, AddSlideSheet) přibude výběr času: 10/20/30/45/60/90/120 s, vlastní hodnota a „bez limitu“. Ukládá se do `activitySpec.timeLimitSec`, tedy uvnitř slidu v existujícím JSON.
- Pořadí platnosti: slide → nastavení hry → dnešní chování. Rozhoduje jedna sdílená funkce `resolveTimeLimitSec` (stejná pro klient i server, v `_shared`).
- Výchozí hodnota pro nové kvízové slidy: 30 s.
- Použije ji odpočet, automatické odhalení, `submit-answer`, `submit-activity-response` a bodování.
- Staré slidy bez pole se chovají přesně jako dnes, včetně záložních 20 s.
- Vyžaduje úpravu serverových funkcí, nasadí Claude.

**Etapa 2 – úvodní stav „Spustit“ (bez DB):**
- Do `game_sessions.settings` se uloží `armedQuestion: index` (slide je připravený, ale ještě nespuštěný).
- Přechod na aktivní slide v ručním režimu nastaví `armed` a `question_started_at` zatím neposune. Tlačítko „Spustit“ v `LiveTeacherScreen` zapíše `question_started_at = now` a `armed` zruší.
- Žák v tu chvíli vidí čekárnu „Učitel aktivitu za chvíli spustí“ (jedna obalová komponenta pro všechny typy) a projektor zobrazí otázku bez možností a odpočtu.
- Server (`submit-answer`, `submit-activity-response`) odpověď na připravený, ale nespuštěný slide odmítne.
- Přepínač „Spouštět aktivity: ručně / automaticky“ je na úrovni hry. Výchozí je ručně u prezentací z lekce a automaticky u klasických her, takže chování starých her se nezmění.
- Tempo řízené žákem a závod se nemění.

**Etapa 3 – za chodu:** tlačítka „+10 s“ a „+30 s“ (`settings.timeExtensions[index]`, zohlední je odpočet i server) a tlačítko „Ukončit a ukázat výsledky“.

## Testy
- Stará data bez nového pole se chovají jako dnes (včetně 20 s).
- Čas nastavený na slidu má přednost před nastavením hry a „bez limitu“ vypne automatické odhalení.
- Žák nemůže odpovídat před spuštěním a server takovou odpověď odmítne.
- Odpočet začíná až po spuštění.
- Prodloužení času posune konec odpočtu i na serveru.
- Závod a tempo žáka se nemění.
- Bodování podle režimů (standard/tower/steal) zůstává stejné.
- Mobil 390 px.

## Rizika
- Změna serverových funkcí může ovlivnit bodování. Proto jedna sdílená funkce a testy pro stará data.
- Připojení žáka uprostřed připraveného slidu: čekárna se musí obnovit z `settings`.
- Demo režim se nemění.

## Otevřené otázky pro Tynu
1. Má mít časovač i zeď, anketa a oblak slov (po vypršení se zavře odpovídání), nebo jen kvízové otázky?
2. Výchozí čas pro nový kvíz: 30 s?
3. Má být ruční „Spustit“ výchozí všude, nebo jen u prezentací z lekce?

---

# Příloha (samostatný plán, beze změny): Demo – únik obsahu skutečných učitelů

## Příčina (jistá pro 9 listů, zbytek pravděpodobný)
Nabídka „+ Přidat list“ (`TeacherAssignments.tsx` ř. 398–404) čte `worksheets` bez filtru na autora a spoléhá jen na RLS. Únik vzniká souhrou dvou pravidel:

1. **Povolující politika** „Students can read worksheets shown in lesson“ volá `can_student_view_worksheet_in_lesson`. Pro listy s typem zdroje `global` dál volá `can_view_textbook_lesson`, která pustí **každého učitele** přes `is_admin_or_teacher()` (stačí role teacher, nekontroluje se škola ani autor). Tyna má 9 listů, které jsou zveřejněné, mají zapnuté „ukázat v lekci“ a jako zdroj globální lekci. Tyto listy projdou každému učiteli, tedy i demo učiteli.
2. **Omezující `demo_iso`** na `worksheets` používá `demo_can_see_owned(teacher_id)`. Ta vrací true i tehdy, když autor **není demo uživatel** (`OR NOT is_demo_user(_owner)`). Izolace tak zastaví jen cizí demo páry, nikdy skutečné učitele.

Ostatní cesty jsem vyloučila čtením dat:
- **Plán hodiny** („Students can read worksheets via lesson plan“): demo učitelé nejsou členy žádné třídy ani skupiny, takže 0 listů.
- **Sdílení a spolupráce:** potvrzuji Vaše zjištění, že tudy listy neprojdou.

Chybějící 2 do počtu 11 jsou pravděpodobně jiná kombinace stejné souhry. Přesně je ověřím v testu po opravě. Funkce databáze se z mého přístupu nedají spustit, proto byl rozbor proveden nad daty a definicemi.

**Klíče správných odpovědí:** RLS pouští celý řádek, takže demo učitel může číst i `spec` včetně klíčů (pravděpodobné, sloupcová práva jsem neověřovala). Obsah jsem nevypisovala.

Pozor: bod 1 platí i mimo demo. **Každý ne-demo učitel** dnes vidí tyto listy učitelů z jiných škol. Oprava níže se ne-demo uživatelů záměrně netýká (viz otevřené otázky).

## Rozsah u dalších tabulek
| Tabulka | Izolace dema | Vidí demo obsah skutečných učitelů? |
|---|---|---|
| worksheets | `demo_can_see_owned` (děravé) | **ano, jisté** (9+) |
| teacher_presentations | `demo_can_see_owned` | ano, pokud je demo učitel pozván ke spolupráci; jinak ne. Únik je možný, nyní pravděpodobně 0 |
| question_bank_items | `demo_can_see_owned` | ne (povolující politika jen vlastník) |
| teacher_textbooks | `demo_can_see_owned` | ano u záměrně veřejných: systémové učebnice (`is_system`, knihovna) a veřejně sdílené náhledy. Ostatní jen po zápisu nebo sdílení |
| game_sessions, notebooks | `demo_can_see_user` (správně) | ne |
| teacher_game_templates | jen vlastník | ne |
| activity_templates | bez demo_iso | ne (jen vlastník) |
| lesson_plans | bez demo_iso | jen plány „public“ (dnes 0) a plány v rámci demo školy |
| teacher_textbook_lessons, textbook_lessons | bez demo_iso | čtení podle učebnic; zápis do textbook_lessons blokuje demo_guard |
| **lessons** | bez demo_iso i bez demo_guard | tabulka je prázdná (0 řádků), čte ji jen funkce `generate-practice`. Každý učitel včetně dema by mohl upravovat i mazat |
| lesson_placements, student_activity_results, student_lesson_completions | bez demo_iso | vyžaduje samostatné ověření, v tomto plánu se nemění |

Záměrně veřejná knihovna jsou systémové učebnice (`is_system`) a veřejně sdílené učebnice, ty zůstanou dostupné.

## Návrh oprav (jen přidání omezujících pravidel, chování pro ne-demo uživatele beze změny)

**Etapa 1 – pracovní listy (doporučuji hned, čeká na „schvaluji“):**
```sql
CREATE POLICY demo_iso_strict ON public.worksheets AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.is_demo_user(auth.uid())
  OR is_demo_seed
  OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid()))
);
-- rollback:
-- DROP POLICY IF EXISTS demo_iso_strict ON public.worksheets;
```
- Demo učitel uvidí jen svoje listy, listy svého páru, sdílené demo autory a ukázkové listy.
- Demo žák dál otevře list od svého učitele, protože učitel patří do jeho páru (cesta 0082 zůstává).

**Etapa 2 – prezentace a učebnice (stejný vzor):**
```sql
CREATE POLICY demo_iso_strict ON public.teacher_presentations AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR is_demo_seed
       OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid())));
CREATE POLICY demo_iso_strict ON public.teacher_textbooks AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR is_demo_seed OR is_system
       OR public.is_public_shared_textbook(id)
       OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid())));
-- rollback: DROP POLICY IF EXISTS demo_iso_strict ON public.teacher_presentations;
--           DROP POLICY IF EXISTS demo_iso_strict ON public.teacher_textbooks;
```

**Etapa 3 – `lessons`:** zákaz zápisu pro demo (prázdná tabulka, bez dopadu).
```sql
CREATE POLICY demo_guard_update ON public.lessons AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_delete ON public.lessons AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_demo_user(auth.uid()));
-- rollback: DROP POLICY IF EXISTS demo_guard_update ON public.lessons; DROP POLICY IF EXISTS demo_guard_delete ON public.lessons;
```

Funkci `demo_can_see_owned` neměním: používají ji i jiné tabulky a změna by mohla rozbít ukázková data. Nové pravidlo je samostatné a jde snadno vrátit.

## Testy (po každé etapě, kontrola jen počtů a názvů, ne obsahu)
- Demo učitel nevidí žádný Tynin list. Vidí svoje a 2 ukázkové.
- Demo žák otevře list přiřazený svým demo učitelem.
- Ne-demo učitel a Tyna vidí stejné počty listů jako před opravou. Tynini žáci otevřou své úkoly.
- Etapa 2: demo dál vidí systémové učebnice a ukázkovou učebnici, ale ne Tyniny prezentace.
- Malý pomocný test (`demo-isolation`) zrcadlí pravidlo v kódu pro budoucí změny.

## Rizika
- Pokud sdílený demo autor není v `demo_shared_users`, jeho ukázkové listy zmizí. Ověřím počty před i po opravě a v případě potřeby pravidlo vrátím.
- Cizí obsah, který demo účty mohly dosud přiřadit do úkolů, se po opravě demo žákům nezobrazí. Ověřím počet takových úkolů, nic nemažu.
- Neúspěšnou migraci nebudu opakovat.

## Otevřené otázky
1. Schvalujete etapu 1 samostatně, nebo etapy 1–3 najednou?
2. Mají i **běžní učitelé** z jiných škol přestat vidět cizí listy „ukázané v lekci“? To by byla samostatná oprava s dopadem na ne-demo uživatele.
3. Mají demo účty vidět veřejně sdílené učebnice, nebo jen systémové a ukázkové?
