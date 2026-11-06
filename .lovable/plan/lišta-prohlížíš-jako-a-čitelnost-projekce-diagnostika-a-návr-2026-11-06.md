# Lišta „Prohlížíš jako“ a čitelnost projekce – diagnostika a návrh

Jen diagnostika. Žádný kód, žádná změna databáze, nic se nenasadilo.

## A) Plovoucí lišta „Prohlížíš jako Učitel × Zpět na admina“

### Kde je a jak se řídí viditelnost
- Komponenta je `src/components/ViewAsBanner.tsx`. V `src/App.tsx` (ř. 121) se vykresluje globálně nad **všemi** stránkami, tedy i nad projektorem, živou hrou a prezentací.
- Lišta je vidět, když `realRole === "admin"` a `viewAsRole` je jiná role než admin. Na adrese stránky nezáleží, celoobrazovkový režim nijak nezohledňuje.
- Pozice je `fixed bottom-4 left-1/2 -translate-x-1/2 z-50`, tedy **uprostřed dole**. Uvnitř je text „Prohlížíš jako **Učitel**“ a tlačítko „Zpět na admina“.
- Lišta navíc nastaví `document.body.style.paddingBottom = 4.5rem`. Na projektoru, kde je stránka přes celou výšku (`min-h-screen`), tím vzniká posun obsahu nebo posuvník.

### Proč vypadá na každém zařízení jinak
- Lišta nemá `whitespace-nowrap` ani omezení šířky. Na úzkém telefonu se text i tlačítko zalomí do 2–3 řádků a lišta zakryje obsah (Dnes, úkoly).
- Nezohledňuje bezpečnou oblast iPhonu (spodní lištu Safari).
- Na PC má plnou velikost písma `text-sm` a je posazená uprostřed, takže překrývá patičku.
- Na projekci stojí uprostřed dole přímo nad snímkem.

### Návrh (jen frontend)
1. **Jedna kompaktní podoba všude:** jednořádková pilulka **vpravo dole** (`whitespace-nowrap`, `max-w` podle šířky obrazovky).
   - Na telefonu jen ikona oka a „Zpět“; popis „Prohlížíš jako Učitel“ bude jako `aria-label` a tooltip.
   - Spodní odsazení bude počítat s bezpečnou oblastí iPhonu (aspoň 5rem nad lištou Safari), stejně jako pilulka testovacího žáka. Obě pilulky se nebudou překrývat, druhá se posune výš.
2. **Ruční úprava odsazení stránky odpadne.** `body.paddingBottom` lišta nebude nastavovat, protože je malá a v rohu.
3. **Projekční a celoobrazovkové stránky:** na `/live/projektor/*`, v živé hře, v promítání lekce a prezentace a v režimu celé obrazovky (`document.fullscreenElement`) se zobrazí jen **miniaturní ikona 32 px** v pravém horním rohu. Bude průsvitná, plně viditelná při najetí myší nebo zaměření klávesnicí a bude mít tooltip „Zpět na admina“.
   - Ikona se po 3 s nečinnosti skryje spolu s ostatním ovládáním (viz B3).
   - Seznam těchto stránek bude v jednom místě (`isPresentationRoute(pathname)`).
4. **Návrat na admina zůstane vždy dostupný:** ikonou i přes menu „Přepnout roli“, které už je nasazené. Klik bude dělat přesně to co dnes: `setViewAsRole(null)` a přechod na `/admin`.

## B) Projekce `/live/projektor/<id>` – proč je snímek malý

### Jak se snímek dnes škáluje (`src/components/live/ProjectorSlideView.tsx`)
1. **Vnější scéna** 1600×900 px se zmenší na okno (`scale = min(šířka/1600, výška/900)`, ř. 116–120).
2. **Uvnitř scény** zabírá místo pevné „ovládání“:
   - progress lišta (8 px),
   - šedá hlavička s názvem a „Snímek 3/32“ (ř. 214–217, zhruba 80 px),
   - okraje `px-6 py-4`,
   - patička „Kód: …“ a „12 žáků online“ (ř. 300–303, zhruba 90 px).
3. **Vnitřní scéna** `ProjectorCanvasStage` (ř. 22–70) je **znovu** 1600×900 a znovu se zmenší, tentokrát do zbylého prostoru (asi 1550×700, ř. 43).

Následek: snímek se zmenšuje **dvakrát**. Výška snímku je asi 78 % okna, a protože vnitřní zmenšení řídí výška, je stejně úzký i do šířky. Na oknech jiného tvaru než 16:9 (16:10, notebook se záložkami) navíc přibydou okraje kolem.

### Proč nepomáhá zvětšení v prohlížeči
Měřítko se počítá z rozměrů okna. Když prohlížeč zvětší, okno má v CSS pixelech méně místa, výpočet měřítko o stejný poměr zmenší a výsledná velikost zůstane stejná. Ovládání velikosti písma, A−/A+ ani „Vyplnit plochu“ neexistuje. Na projektoru je jen tlačítko „Zavřít“ (`LiveProjectorScreen.tsx` ř. 45).

### Proč tabulka nezaplní prostor
Tabulka je blok uvnitř `SlideCanvas` s pozicí a velikostí písma z editoru (souřadnice 1600×900). Nikdy není větší, než ji autor nakreslil v editoru, a k tomu se zmenšuje dvojím škálováním výše. Rozvržení snímku je záměrně shodné s editorem; dle pravidla projektu se pozadí snímku vždy centruje na scénu 16:9.

### Rušivé prvky
- Hlavička s názvem a „Snímek X/Y“ a patička s kódem a počtem žáků jsou vidět stále.
- Pod nimi je volitelný pruh s tabulí (ř. 252) a tlačítko „Zavřít“.
- Nad tím vším je lišta „Prohlížíš jako“ uprostřed dole (viz A).

### Návrh (jen frontend, bez DB)
1. **Snímek přes celou plochu (fit to viewport):**
   - Odstranit dvojí škálování. Snímek se zmenší **jen jednou**, přímo na okno.
   - Hlavička a patička se přesunou do vlastní **překryvné vrstvy** nad snímkem a nebudou ubírat jeho plochu.
   - Snímek tak vyplní 100 % šířky nebo výšky okna místo dnešních asi 78 %.
   - Rozvržení snímku zůstane shodné s editorem.
2. **Velikost A− / A+ / „Vyplnit plochu“:**
   - Malé ovládání v překryvné vrstvě: přiblížení snímku 100–150 % po 10 %, se středem uprostřed, aby se okraje nevešly a obsah vyplnil plochu. Plus tlačítko „Přizpůsobit obrazovce“ (zpět na 100 %).
   - Klávesy `+` / `-` / `0`.
   - Volba se uloží pro dané zařízení (localStorage) a databáze se nemění.
   - Nebude to kolidovat s existujícím přibližováním zón (`zoomStageStyle`), které učitel ovládá na dálku: jde o dvě oddělené vrstvy.
   - Volitelně tlačítko „Celá obrazovka“ (`requestFullscreen`).
3. **Režim „Čistá projekce“:**
   - Hlavička, kód, počet žáků, Zavřít, A−/A+ a ikona Zpět na admina se po **3 s bez pohybu myši** skryjí plynulým zprůhledněním.
   - Znovu se zobrazí při pohybu myši, dotyku nebo klávese.
   - Progress lišta (tenká) zůstane.
   - Kód pro připojení zůstane vždy v úvodní obrazovce s QR kódem, ta se nemění.
   - Respektovat `prefers-reduced-motion`; při zaměření klávesnicí se ovládání neskrývá.
4. **Minimální čitelnost:** tabulky a texty ve `SlideCanvas` se nemění, protože by to rozbilo shodu s editorem. Čitelnost z posledních lavic zajistí body 1–2. Upozornění na příliš malé písmo v editoru je možné jako budoucí krok, není součástí návrhu.

## Soubory
- `src/components/ViewAsBanner.tsx`: kompaktní podoba, roh, bezpečná oblast, režim ikony.
- Nový `src/lib/presentation-routes.ts`: `isPresentationRoute()` a test.
- `src/components/live/ProjectorSlideView.tsx`: jedno škálování, překryvná vrstva ovládání, A−/A+.
- Nový `src/hooks/useIdleChrome.ts`: skrývání po 3 s.
- `src/pages/LiveProjectorScreen.tsx`: tlačítko Zavřít do překryvné vrstvy.

## Rizika
- Změna škálování projektoru se dotkne všech typů snímků: aktivity, MCQ, nástěnka, word cloud, týmy, únikovka, závod, tabule. Překryv tabule (`LiveWhiteboard`) musí sedět na stejné souřadnice jako snímek, jinak se tahy posunou. **Kritické k otestování.**
- Na projektoru se nesmí změnit časování, bodování ani synchronizace snímků. Měníme jen vzhled.
- Skrytý kód pro připojení: pozdní příchozí žák ho uvidí po pohybu myši. Lze přidat přepínač „Kód vždy viditelný“.
- Lišta pro admina nesmí zmizet úplně: ikona plus menu „Přepnout roli“.

## Testy
- Vitest:
  - `isPresentationRoute` (projektor, hra, lekce ano; Dnes, úkoly ne).
  - `ViewAsBanner`: na projekci jen ikona s `aria-label` „Zpět na admina“; klik volá `setViewAsRole(null)`; mimo admina se nevykreslí.
  - `useIdleChrome`: skrytí po 3 s, zobrazení při pohybu, neskrývá se při zaměření.
  - Výpočet měřítka a přiblížení (hranice 100–150 %, uložení a obnova, chyba localStorage).
- Playwright: 1920×1080, 1440×900 (16:10) a 390×844. Snímek vyplní šířku nebo výšku, lišta je jednořádková a v rohu. Jen na vlastní ukázkové relaci `[TEST]`, bez skutečných tříd a bez přihlašování za žáky.

## Zakázáno bez dalšího souhlasu
DB/RLS, změny her nebo bodování, úpravy obsahu snímků, deploy.

---

# Diagnostika: špatně přiřazený plán k hodině (Co nás čeká)

## Zjištění (ověřeno čtením kódu, DB jen SELECT)
- Karta: `src/pages/TeacherSubjectClass.tsx` ř. 1490–1556. Když `findPlanForDate(dateKey)` najde plán, vykreslí jen ikony příloh + „Otevřít"; větev s „Přiřadit"/„Nový" je jen v `else` (bez plánu). Neexistuje „Změnit" ani „Odebrat" – není skryté v menu ani jen na mobilu; je to chybějící funkce, ne záměrné omezení.
- Ukládání: žádná vazební tabulka. Přiřazení = položka v `lesson_plans.input_data.linkedSlots[]` (`{subject, classId|groupId, className, date, time}`), zapisuje `assignPlanToDate()` (ř. 1160–1213) přes `update({input_data})` na vlastním plánu (RLS vlastníka, beze změny).
- Chyba navíc: `assignPlanToDate` při novém přiřazení čistí stejné datum jen v **nově vybraném** plánu. Starý (špatný) plán svůj slot dál drží, takže dva plány jsou na stejném termínu a `findPlanForDate` vrátí první nalezený – po „Přiřadit existující plán" (tlačítko v hlavičce) může karta dál ukazovat špatný plán.
- Téma (`lesson_topics`) a reflexe se párují podle třídy/skupiny + předmětu + data, ne podle plánu → odpojení plánu je neovlivní. Přílohy/listy/úkol patří plánu (zůstanou v plánu).
- DB: 29 plánů má aspoň jeden termín, 22 z nich je `visible_to_students`.
- Žáci: `StudentSubjectClass` nečte `linkedSlots`; žákovská viditelnost plánu se řídí `visible_to_students`/`visible_from`, nikoli přiřazením k datu (podrobně neověřeno ve všech žákovských pohledech, ověřit v etapě 1).

## Okamžitý ruční postup pro učitelku (bez kódu)
1. Na kartě dnešní hodiny klikněte „Otevřít" (otevře špatný plán).
2. V sekci „Další přiřazené termíny" u štítku „… · 6. 11. · 10:40" klikněte na křížek „Odebrat termín".
3. Pokud je termín nastaven i nahoře jako hlavní datum/čas plánu, vymažte ho tam.
4. Uložte plán a vraťte se na předmět – karta ukáže „Přiřadit"/„Nový"; vyberte správný plán.
Plán, jeho obsah, téma hodiny ani reflexe se tím nesmažou.

## Návrh (jen frontend, bez DB)
- Na přiřazené kartě přidat tlačítko „Změnit" (menu): „Přiřadit jiný plán" (otevře stávající dialog předvyplněný datem) a „Odebrat plán z hodiny" (potvrzovací dialog).
- Nová funkce `unlinkPlanFromDate(planId, dateKey)`: odstraní z `linkedSlots` jen položky daného data + kontextu (třída/skupina, předmět); zbytek `input_data` zachová.
- `assignPlanToDate`: před zapsáním nového plánu odpojit stejné datum+kontext ze **všech ostatních** vlastních plánů (sekvenčně, při chybě toast a žádné částečné tvrzení o úspěchu).
- Text v potvrzení: „Plán zůstane uložen v Plánech hodin. Téma hodiny, reflexe a materiály plánu se nemění. Viditelnost plánu pro žáky se tím nemění."
- Logiku čištění slotů vyčlenit do čisté funkce (`src/lib/plan-linked-slots.ts`) pro testy.
- DB změna není potřeba (zápis do vlastního plánu už RLS povoluje).

## Rizika
- Plány přiřazené ke skupině bez `classId/groupId` (staré sloty) – odpojovat jen se shodným předmětem.
- Dvouhodinovka ve stejný den: klíč je datum (čas se v kartě neporovnává) – zachovat stávající chování, nerozšiřovat.
- Cizí plán (sdílený) nelze upravit RLS → zobrazit srozumitelnou chybu.

## Testy (Vitest)
- odpojení odstraní jen slot daného data/kontextu, ostatní termíny a pole zůstanou;
- nové přiřazení odpojí stejné datum z jiného plánu, jiné datum nechá;
- karta s plánem nabízí „Změnit"; po odebrání se vrátí „Přiřadit"/„Nový";
- téma hodiny (`lesson_topics`) se při odpojení nevolá.

---

# Diagnostika: tisk AI metody a modelové situace (jen čtení)

## Zjištění
- Obrazovka je `TeacherSuggestByMethod` na `/ucitel/navrh-podle-metody` (`src/pages/TeacherSuggestByMethod.tsx` ř. 1175–1235: nadpis, souhrn, „Modelová situace“ + Bezlai, „Úkol / otázka“, fáze s časy a pomůckami). Akce u výsledku (ř. 1266–1302): slidy, aktivity do lekce, pracovní list, plán hodiny – **žádný tisk/PDF**.
- Tisk prohlížečem (Ctrl+P) vyjde prázdný: `src/index.css` ř. 215–224 při tisku skryje vše kromě `.print-area`, která je jen v rozvrzích (TeacherSchedule/StudentSchedule). Závěr z kódu, v prohlížeči nereprodukováno.
- Data: `modelSituation.{scenario, task}` (edge `suggest-lesson-from-methods` ř. 214–223). Při „Vytvořit plán hodiny“ se uloží do `lesson_plans.student_description` jako „scénář + Úkol: …“ (ř. 555–568); souhrn do `input_data.description`.
- Plán hodiny: tlačítko „Tisk“ v náhledu (`TeacherLessonPlanEditor.tsx` ř. 1422) volá **detailní** šablonu; `src/lib/lesson-plan-pdf-export.ts` krátká (ř. 74–104) ani detailní (ř. 106–165) `studentDescription` nevykreslují; jen „Studentský plán“ (ř. 168–194) má sekci „Zadání“. Proto v tisku plánu zadání chybí.
- DB (anonymně): 41 plánů, 16 má vyplněné zadání pro žáky, 5 obsahuje „Úkol:“; 3 mají ve fázích text o modelové situaci.

## Okamžitý náhradní postup pro učitelku
1. Na výsledku metody klikněte „Vytvořit plán hodiny z tohoto návrhu“.
2. V plánu hodiny zvolte „Exportovat PDF“ → **„Studentský plán“** (obsahuje Zadání = modelová situace + úkol), případně zvlášť „Detailní plán“ pro fáze, časy a pomůcky.
3. Pokud se nic neotevře, povolte vyskakovací okna pro bezli.cz. Ctrl+P na stránce metody nepomůže (vyjde prázdná stránka).

## Návrh (frontend, bez DB)
- `lesson-plan-pdf-export.ts`: do krátké i detailní šablony přidat sekci „Modelová situace / Zadání“ z `studentDescription` (jen pokud vyplněno), rozdělit „Úkol:“ do vlastního rámečku; štítek „AI generováno“ (EU AI Act).
- Na `TeacherSuggestByMethod` tlačítko „Vytisknout / Uložit PDF“: převést návrh na stejný `LessonPlanPdfInput` (fáze, minuty, pomůcky, popis, modelová situace) a použít existující exportér – jeden renderer pro metodu i plán.
- Přepínač „Verze pro učitele / Zadání pro žáky“ = existující šablony detailní / studentská.
- Volitelně: tiskové CSS neskrývat obsah stránek mimo `.print-area` – NEdělat globálně (rozvrhy na tom závisí), jen přes vlastní exportér.

## Rizika
- Blokování vyskakovacích oken – exportér už hlásí chybu; zvážit tisk přes iframe jako u pracovních listů.
- Starší plány bez `student_description` – sekce se jen nezobrazí.
- Formát „Úkol:“ je textová konvence; dělení musí tolerovat ručně upravený text.

## Testy
- detailní i krátká šablona obsahují „Modelová situace“ a úkol, když je `studentDescription`; bez něj sekce chybí;
- převod návrhu metody na export zachová fáze, minuty, pomůcky, scénář a úkol;
- studentská verze neobsahuje učitelské poznámky.

---

# Diagnostika: modelová situace v tisku, pracovním listu a plánu hodiny

## Příčiny
1. **Pracovní list z návrhu** (`TeacherSuggestByMethod.tsx:629-692` → sessionStorage `bezli.worksheetPrefill:<id>` → `WorksheetEditor.tsx:1379-1402, 1699-1778` → edge `generate-full-worksheet`). Modelová situace i úkol se předávají, ale jen jako volný text v `lessonContent`. Prompt (`generate-full-worksheet/index.ts:325-371`) je nemusí zachovat. Při zvolených sekcích platí „Dodrž PŘESNĚ typy… nic jiného negeneruj“ (ř. 341), takže vzniknou jen obecné otázky. Text navázané lekce má navíc přednost před kontextem návrhu (ř. 1699-1718). Pomůcky, instrukce pro učitele ani zdůvodnění metod se nepředávají. Kontext zmizí, pokud se sessionStorage ztratí.
2. **Plán hodiny z návrhu** (`TeacherSuggestByMethod.tsx:523-578`): situace a úkol se uloží jen do `student_description`, instrukce a zdůvodnění do `teacher_instructions`, fáze do `input_data.phases` (čas, popis, aktivity). Cíl, forma práce, kompetence a poznámky pro hospitaci se neukládají vůbec, protože je metoda nemá jako samostatná pole. `lesson_plan_phases` obsahuje jen pomůcky (`lesson-plan-equipment.ts:23-47`).
3. **Tisk** (`lesson-plan-pdf-export.ts`): pole „Cíle fáze / Kompetence / Forma práce / Poznámky pro hospitaci“ jsou natvrdo prázdná (ř. 125-147). Krátký ani detailní tisk nevykreslí situaci, úkol, instrukce ani zdůvodnění, protože je export nedostává. Studentský tisk úkol ukazuje pod „Zadání“. Třída a datum jsou `selectedTargetName`/`linkedDate`, takže u plánu bez termínu se zobrazí „—“. U odkazů se vypisuje jen název bez typu (ř. 66-71), materiály a `worksheet_ids` se netisknou.
4. U metody není tlačítko tisku (ř. 1266-1315).

## Návrh minimální opravy (bez DB)
1. **Pracovní list:** předat strukturovaný parametr `caseStudy {scenario, task}` do `generate-full-worksheet`. Na začátek listu dát deterministicky (bez AI) `instruction_box` „Případová studie“ s doslovným textem situace a úkolu. AI dostane pokyn, aby otázky navazovaly na zadání. Sekce zůstanou dodrženy, blok se k nim přidá. Kontext návrhu bude mít přednost před textem lekce, když přichází z návrhu. Navíc se uloží do `spec.meta`, aby nezávisel na sessionStorage.
2. **Plán hodiny:** navíc ukládat `input_data.modelSituation {scenario, task}`, `input_data.methodRationale` a `input_data.teacherInstructions`. `student_description` zůstane beze změny, takže žákovský pohled se nemění. Editor ukáže blok „Modelová situace“ a dovolí ho upravit.
3. **Fáze:** do `input_data.phases[i]` přidat volitelná pole `goal`, `workForm`, `notes`. Forma práce se odvodí z textu („ve dvojicích“ → práce ve dvojicích, „skupin“ → skupinová, „individuálně/samostatně“ → individuální). Cíl fáze se předvyplní u Hlavní části odkazem „Práce na zadání případové studie“, u ostatních fází zůstane prázdný a učitel ho upraví. Kompetence se nevymýšlejí, zůstanou prázdné k doplnění.
4. **Tisk:** detailní a krátký tisk dostanou blok „Modelová situace a úkol“, „Instrukce pro učitele“ a „Proč tyto metody“ (jen v detailním). Vyplněná pole fází se vykreslí, prázdná zůstanou jako řádky k ručnímu dopsání. U odkazů se doplní typ: „Pracovní list: …“, „Kvíz: …“, „Aktivita: …“. U plánu bez termínu se zobrazí třída/skupina plánu, jinak „—“ (datum se nevymýšlí).
5. **Tlačítko „Vytisknout / Uložit PDF“** u výstupu metody: mapování návrhu na stejný `exportLessonPlanPdf`, volba Krátký / Detailní / Pro žáky, bez ukládání.

## Rizika
- AI může i tak generovat obecné otázky. Proto bude situace a úkol vložena deterministicky, AI připíše jen otázky.
- Staré plány nemají `input_data.modelSituation`. Tisk proto použije záložně `student_description`.
- Odvozená forma práce může být nepřesná, je jen předvyplněná a upravitelná.
- Úprava edge funkce `generate-full-worksheet` vyžaduje její nasazení. Funkce zůstane zpětně kompatibilní, protože parametr je volitelný.
- Vyhnout se dvojímu bloku „Zadání“ ve studentském tisku.

## Testy
- Čistá funkce `buildCaseStudyBlock`: obsahuje doslovné zadání a úkol, prázdné pro chybějící data.
- `inferWorkForm`: dvojice/skupina/individuální/neznámé.
- Mapování návrhu na plán: `modelSituation`, fáze s `goal/workForm`; `student_description` beze změny.
- PDF export: detailní obsahuje situaci, úkol, instrukce a vyplněná pole fází. Starý plán použije záložní hodnotu. Odkazy mají typ. Třída bez data → „—“ pro datum.
- Deno test promptu: `caseStudy` je v promptu a sekce se zachovají.

## DB
Není potřeba.
