# Plán hodiny pro žáky: přílohy, okamžité zobrazení, lekce a pracovní list

## Co jsem zjistila

**1. Přílohy u plánu hodiny — dnes neexistují.**
Plán hodiny je uložený v tabulce plánů (`lesson_plans`) a má jen název, předmět, popis, fáze a propojení; žádné pole pro soubory ani odkazy. Stejný mechanismus, jaký chceme, už ale v aplikaci běží dvakrát: u příloh úkolu a u „materiálů k hodině“ v zápisu probrané látky (tam je seznam souborů/odkazů uložený jako jeden sloupec a soubory leží v úložišti `assignment-materials`). Tento hotový mechanismus se dá použít i pro plán hodiny — stačí přidat jedno pole `materials` do plánu.

**2. Žák dnes plán hodiny nevidí vůbec.**
Na stránce Předmět/Třída žáka se plány hodin nikde nenačítají — záložky „Co jste probrali“ a „Co tě čeká“ staví jen z rozvrhu a k proběhlým hodinám dotahují téma a materiály ze zápisu učitele. Bariéra je dvojí:
- v kódu: stránka se na plány vůbec nedotazuje;
- v pravidlech přístupu: plán smí číst jen jeho autor, spoluautoři předmětu, škola nebo veřejné plány. Žák nemá žádné právo čtení.
Proto se dnes žákovi cokoliv z hodiny objeví až potom, co učitel po hodině napíše téma — nikoli při naplánování.

**3. Propojení plánu s lekcí učebnice už existuje.**
Plán si vybranou lekci ukládá (`lessonId` v datech plánu, u globálních lekcí i sloupec `lesson_id`). Je to stejný princip jako u úkolů, takže se pro proklik do učebnice dá použít beze změny schématu — jen je potřeba u učitelských lekcí ukládat i typ zdroje (globální/učitelská), aby se sestavila správná adresa (na to už máme pomocnou funkci pro „propojenou lekci“).

**4. Vazba plán → pracovní list přímo není, ale jde odvodit.**
Pracovní list si pamatuje, z jaké lekce vznikl (`source_lesson_id` + typ). Takže pracovní listy k plánu se dají najít podle shodné lekce. Přímé propojení „tento list patří k tomuto plánu“ zatím neexistuje.
„Vložit do portfolia“ dnes existuje jen jako ruční formulář v portfoliu žáka; portfolio už ale zná typ zdroje `worksheet` a odkaz na zdroj, takže se dá přidat jednoklikové vložení.

## Návrh řešení

### A. Přílohy plánu hodiny
- Přidat plánu pole `materials` (stejný formát jako u úkolů: odkaz nebo soubor s názvem, typem a velikostí).
- V editoru plánu použít existující editor materiálů (stejné omezení formátů a velikostí: 20 MB, video 100 MB).
- Sdílet stávající úložiště `assignment-materials`, aby platila už hotová pravidla přístupu; doplnit je tak, aby soubor přiložený k plánu směl otevřít i žák, kterému je plán zobrazen.

### B. Zveřejnění plánu žákům
- Přidat plánu přepínač „Zobrazit žákům“ (výchozí zapnuto při vybraném cíli) a datum/čas, od kdy je vidět (výchozí ihned po uložení).
- Doplnit pravidlo přístupu: plán smí číst žák, který je členem cílové třídy nebo skupiny plánu, je-li plán zveřejněný. Cíl už se v plánu ukládá jednotně pro třídu i skupinu, takže se použije stejné rozlišení jako všude jinde.
- Aby pravidlo šlo napsat spolehlivě a rychle, vytáhnout cíl a příznak zveřejnění z volných dat plánu do skutečných sloupců (`class_id`, `group_id`, `visible_to_students`, `visible_from`) a při ukládání je plnit společně se stávajícími daty.

### C. Zobrazení u žáka
- Na žákovské stránce Předmět/Třída načítat zveřejněné plány pro danou třídu/skupinu a párovat je na hodiny v rozvrhu podle data a času (plán už si datum a čas navázané hodiny ukládá).
- Plán se zobrazí u nadcházející hodiny jako karta „Plán hodiny“ s názvem, popisem, fázemi (co se bude dít a kolik minut) a přílohami. Nespárované zveřejněné plány ukázat v samostatném seznamu „Plány hodin“.
- Stejnou kartu použít i u proběhlých hodin, aby si žák mohl plán dohledat zpětně.

### D. Prokliky z plánu
- **Lekce:** pokud plán má lekci, tlačítko „Otevřít lekci“ vede do učebnice přes existující řešení propojené lekce (globální i učitelská). Zobrazí se jen tehdy, je-li lekce žákovi skutečně dostupná.
- **Pracovní list:** dohledat listy se stejnou zdrojovou lekcí, které jsou zveřejněné, a nabídnout „Otevřít pracovní list“ do žákovského zobrazení listu. Volitelně dovolit učiteli připnout konkrétní list k plánu (nové pole se seznamem ID listů), aby to nezáviselo jen na lekci.
- **Do portfolia:** u pracovního listu (v plánu i na stránce listu) tlačítko „Uložit do portfolia“ — vytvoří položku portfolia typu „pracovní list“ s názvem, předmětem, zdrojem `worksheet` a odkazem na list; opakované kliknutí položku nezduplikuje.

## Technické detaily
- Migrace: `lesson_plans` + `materials jsonb default '[]'`, `class_id uuid`, `group_id uuid`, `visible_to_students boolean default false`, `visible_from timestamptz`, `lesson_source text`, `worksheet_ids uuid[]`; nová SELECT politika pro žáky přes členství (`class_members`, `subject_group_members`) v bezpečné funkci; doplnění politik úložiště.
- Klient: `TeacherLessonPlanEditor.tsx` (materiály, přepínač zveřejnění, plnění nových sloupců), `StudentSubjectClass.tsx` (načtení plánů, karta plánu, párování na rozvrh), nová komponenta karty plánu pro žáka, `resolveLinkedLesson` pro adresu lekce, sdílená funkce „vložit list do portfolia“ použitelná i z `StudentWorksheetView.tsx`.
- Testy: párování plánu na hodinu, viditelnost jen pro cílovou třídu/skupinu, sestavení adresy lekce, nezdvojení položky portfolia.

## Otevřené otázky
1. Má být plán žákům vidět automaticky vždy, nebo až po zaškrtnutí učitelem? (Návrh počítá s výchozím „zobrazit“ u plánů s cílem.)
2. Mají žáci vidět i minutové rozvržení fází, nebo jen názvy aktivit?
