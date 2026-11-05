# Žákovské prostředí na telefonu – diagnostika a návrh (jen čtení)

Stav: diagnostika, nic se neměnilo (bez kódu, DB, migrací i nasazení). Předchozí plány jsou archivované ve složce plánů.

## Souhrn pro učitelku

Co je na telefonu nejvíc zmatečné:
1. **Úkoly nejsou v hlavním menu.** Žák má v menu „Přehled, Moje učebnice, Rozvrh, Připojit se do hry“ a pod „Více“ ještě 6 dalších položek (Učím se, Liga, Portfolio, Moje knihy, Můj sešit, Nápověda). Stránka „Moje úlohy“ tam chybí – žák se k ní dostane jen přes přehled.
2. **Úkoly jsou na třech místech a pokaždé vypadají jinak:** v „Dnes“, v „Moje úlohy“ a v záložce předmětu. Tlačítka se jmenují jednou „Otevřít“, jinde „Detail“.
3. **Přehled je dlouhý a důležité je dole.** Nejdřív banner, liga, profil hráče, teprve potom „Dnes“, pak testy, pokrok, ocenění a dlaždice. Na telefonu je „co mám udělat teď“ až po několika posunutích.
4. **Malá tlačítka.** Většina tlačítek u úkolů je „malá“ velikost (asi 36 px) – menší než doporučených 44 px pro prst.
5. **Stránka předmětu má 4 záložky** (Proběhlé, Nadcházející, Úkoly, Výsledky), které se na úzkém telefonu tísní.

Doporučené pořadí oprav: (1) „co mám udělat teď“ nahoru v Přehledu, (2) větší tlačítka a jednotné „Otevřít“, (3) Úkoly do menu, (4) spodní lišta s 5 položkami.

Pozn.: Prohlídka v prohlížeči na 390 px zatím neproběhla (vyžaduje přihlášení testovacím žákem); nálezy vycházejí z kódu. Screenshoty budou první krok fáze 1.

## Zjištěno v kódu

- `SiteHeader.tsx`: žákovské menu = Přehled `/student`, Moje učebnice, Rozvrh, Připojit se do hry; další položky v rozbalení (`STUDENT_EXTRA_ITEMS` + Liga podle stavu ligy). Žádná spodní lišta neexistuje. „Moje úlohy“ (`/student/ulohy`) ani zprávy v menu nejsou.
- `StudentDashboard.tsx` pořadí: avatar + Bannery/Novinky → `DashboardBanners` → `MyLeagueCard` → `PlayerProfileWidget` → `TodayWidget` → `UpcomingExamsCard` → `StudentProgressWidgets` → `RecognitionWidget` → mřížka dlaždic.
- Úkoly se vykreslují ve třech komponentách: `TodayWidget` (dnes), `StudentAssignments` (skupiny přes `AssignmentStatusGroups`, tlačítka „Otevřít/Detail“ podle stavu), `StudentSubjectClass` (vlastní seznam, „Detail“ i „Otevřít“). Stavová logika je společná (`assignment-status.ts`), vzhled a pojmenování ne.
- Tlačítka `size="sm"` (≈36 px) u karet úkolů, zpět v předmětu a akcí v předmětu.
- `StudentSubjectClass` (966 řádků): 4 `TabsTrigger` v jednom řádku.

## Návrh struktury pro žáka (mobil)

Spodní lišta (jen na šířce pod 768 px), 5 položek, ikona + krátký popisek, výška 56 px:

```text
[ Dnes ] [ Úkoly ] [ Předměty ] [ Rozvrh ] [ Více ]
```

- **Dnes** = dnešní hodiny, změny rozvrhu, „Udělej teď“ (max 3 úkoly).
- **Úkoly** = jediný úplný seznam: Čeká / Po termínu / Odevzdané / Zkontrolované; nahoře filtr Úkoly | Materiály | Oznámení (podle `settings.kind`).
- **Předměty** = seznam předmětů → detail předmětu.
- **Rozvrh** = týden/kalendář.
- **Více** = Učebnice, Učím se, Sešit, Liga, Portfolio, Knihy, Hra, Profil, Nápověda.

Jednotné názvy: „Úkoly“ (ne „úlohy“), tlačítko vždy „Otevřít“, stavy jen Čeká / Po termínu / Odevzdané / Zkontrolované.

### Dnes
```text
+--------------------------------+
| Ahoj, Petře          [zvonek]  |
| UDĚLEJ TEĎ                     |
| [!] Matematika – list 3        |
|     Po termínu      [Otevřít]  |
| [ ] Čeština – sloh             |
|     zítra 23:59     [Otevřít]  |
| Všechny úkoly (5) >            |
| DNES                           |
| 8:00 M   9:00 Čj  ZRUŠENO      |
| Nové materiály (2) >           |
| (liga, pokrok – níž)           |
+--------------------------------+
[Dnes][Úkoly][Předměty][Rozvrh][Více]
```

### Úkoly
```text
+--------------------------------+
| Úkoly | Materiály | Oznámení   |
| Po termínu (1)            v    |
|  Matematika – list 3 [Otevřít] |
| Čeká (3)                  v    |
|  Čeština – sloh      [Otevřít] |
| Odevzdané (4)             >    |
| Zkontrolované (12)        >    |
+--------------------------------+
```

### Předmět
```text
+--------------------------------+
| < Matematika · 7.B             |
| Úkoly (2) | Hodiny | Výsledky  |
|  list 3  Po termínu  [Otevřít] |
| Materiály (3) >                |
| Učebnice >                     |
+--------------------------------+
```
Proběhlé + nadcházející hodiny sloučit do jedné záložky „Hodiny“ (3 záložky místo 4).

## Fáze

**Fáze 1 – jen rozvržení/CSS, bez DB a bez změny dat či stavů**
1. Screenshoty 360/390/430 px jako testovací žák (jen čtení).
2. Přehled na mobilu: `TodayWidget` hned pod pozdrav; liga/profil/pokrok pod něj (pořadí přes `order-*` jen pod `md`).
3. Tlačítka úkolů min. 44 px (`.assignment-card-action`), jednotný text „Otevřít“.
4. Předmět: záložky do 2 řádků/vodorovně posuvné bez přetečení, min. 44 px.
5. „Moje úkoly“ do žákovského menu.

**Fáze 2 – přestavba navigace (po samostatném schválení)**
1. Nová `StudentBottomNav` (jen role žák, jen mobil), „Více“ jako spodní panel.
2. Filtr Úkoly/Materiály/Oznámení na stránce Úkoly; sjednocená karta úkolu pro Dnes/Úkoly/Předmět.
3. Předmět: 3 záložky.
Bez DB; jen prezentace, stavy a oprávnění beze změny.

## Technické detaily

Soubory: `src/components/SiteHeader.tsx`, `src/pages/StudentDashboard.tsx`, `src/components/calendar/TodayWidget.tsx`, `src/pages/StudentAssignments.tsx`, `src/pages/StudentSubjectClass.tsx`, `src/components/assignments/AssignmentStatusGroups.tsx`, `src/index.css`; fáze 2 nově `src/components/student/StudentBottomNav.tsx`, `StudentAssignmentCard.tsx`.

Testy: Vitest – položky spodní lišty podle role (učitel/rodič ji nevidí), filtr druhů podle `assignment-kind.ts`, Liga skrytá při vypnuté lize; Playwright 390 px – žádný vodorovný posun (`scrollWidth <= innerWidth`), všechna tlačítka ≥ 44 px, kontrast AA, ovládání klávesnicí.

Rizika: překrytí obsahu spodní lištou (dolní odsazení + `safe-area-inset`), kolize s hrami/sešitem na celou obrazovku (lištu tam skrýt), demo a testovací žák musí vidět stejné rozhraní, desktop beze změny.

Rollback: čistě frontendové změny – vrácení souborů; žádná data ani DB.

---

# Diagnostika: Kalendář na telefonu a posun/zoom v sešitě (5. 11. 2026)

## Souhrn pro učitelku
- **Kalendář:** každá položka se kreslí na pevné místo podle času přes celou šířku dne. Když hodina a termín úkolu začínají ve stejnou dobu, leží přesně na sobě. Termín úkolu má pevně jen 30 minut, takže se do kartičky název nevejde. Na telefon doporučujeme jednoduchý **seznam**: hodiny podle času a pod nimi sekce „Termíny úkolů“. Na počítači zůstane vše jako teď.
- **Sešit:** plocha sešitu vypíná v prohlížeči všechna gesta prstů. Proto nefunguje přiblížení dvěma prsty a po zvětšení nejde stránkou posouvat. Režim „Jen pero“ sice prstem nekreslí, ale ani neposouvá. Návrh: prst posouvá a dvěma prsty přibližuje, pero kreslí. Přibude tlačítko „Ruka“ a volba „Přizpůsobit šířce“.

## 1) Kalendář – příčina
Soubor: `src/components/calendar/CalendarWeekGrid.tsx` (používá ho `StudentCalendar.tsx` i `TeacherCalendar.tsx`).
- Každá položka je `absolute` s `top = minuty od 7:00`, `height = délka` (min. 20 px) a `left: 4px; right: 4px`. **Souběžné položky se nijak nerozkládají do sloupců**, takže při překryvu leží přes sebe.
- Termíny úkolů mají v `StudentCalendar.tsx` (ř. 90–110) uměle `end = start + 30 min`, tedy 30 px. Dvouřádkový název se do toho nevejde a `overflow-hidden` ho ořízne.
- Další zjištění: položky mimo 7:00–19:00 se zahodí (`return null`). **Termíny ve 23:59 se v mřížce vůbec nezobrazí.** V seznamu je proto potřeba ukázat je také.

## 1) Návrh
- **Pod `md` (méně než 768 px) jen v denním pohledu:** místo mřížky vykreslit novou komponentu `CalendarDayAgenda`.
  - Sekce „Rozvrh“: hodiny seřazené podle začátku. Každá kartička má čas „9:50–10:35“, celý název a zalamovaný text. Zachovají se štítky „Zrušeno“ a odznak reflexe.
  - Sekce „Termíny úkolů“: všechny termíny dne bez ohledu na hodinu (včetně 23:59), s časem a tlačítkem „Otevřít“.
  - Kliknutí se zpracuje stejně jako dnes, přes stávající `onEventClick`.
- **Desktop a týdenní pohled zůstávají beze změny.** Volitelně později a jen po souhlasu: v mřížce rozkládat souběžné položky do sloupců (čistá funkce `layoutOverlaps`) a nastavit min. výšku 44 px.
- Soubory: nový `src/components/calendar/CalendarDayAgenda.tsx`, úprava podmínky vykreslení v `StudentCalendar.tsx` a `TeacherCalendar.tsx` (stejný přepínač). Bez úprav DB a načítání dat.

## 2) Sešit – příčina
Soubor: `src/components/notebook/NotebookCanvas.tsx`, logika ukazatele v `src/lib/notebook-pointer.ts`.
- Plocha stránky má třídu **`touch-none`** (`touch-action: none`, ř. 681). Prohlížeč proto neprovede pinch ani posun prstem. Gesta nepustí ani rodičovský kontejner, protože dotyk začíná na ploše.
- Zoom je udělaný jako `width: zoom*100%` uvnitř `div` s `max-h-[85vh] overflow-auto` (ř. 677). Svislý i vodorovný posun tedy technicky existuje, ale prstem se nedá vyvolat. Vodorovný posuvník je na iOS skrytý, proto stránka působí „oříznutě vpravo“.
- V režimu „Jen pero“ `shouldDrawPointer` dotyk prstem jen ignoruje (`return`). Žádné posouvání ani zoom za něj ale nenastane.
- Vlastní gesto pinch v kódu neexistuje. Zoom se mění jen tlačítky −/+ a klávesami (50–250 %).

## 2) Návrh
1. **Vlastní zpracování gest** (`touch-action: none` zůstane, aby pero na iPadu nespouštělo posun):
   - Dotyk prstem, když se nekreslí (režim „Jen pero“ nebo nástroj „Ruka“): 1 prst posouvá `scrollLeft/scrollTop` zoom kontejneru, 2 prsty dělají pinch.
   - Pinch mění zoom podle poměru vzdálenosti prstů (ne pevným krokem). Kotva je střed mezi prsty: přepočítá se scroll, aby obsah pod prsty zůstal na místě.
   - Logika půjde do čisté funkce v `src/lib/notebook-gestures.ts`, aby šla testovat.
   - Pero kreslí vždy. Druhý prst během tahu tah zruší a přepne na pinch (stávající `gateRef` zachovat).
2. **Výchozí chování na dotykovém zařízení:** prst nekreslí, pokud uživatel výslovně nezvolí kreslení prstem. Dnešní preference `penOnly` v localStorage se respektuje. Změna výchozí hodnoty jen po potvrzení (otázka níže).
3. **Nástroj „Ruka/Posun“** v liště nástrojů (ikona `Hand`, min. 44 px, `aria-pressed`). Prst i myš pak jen posouvají.
4. **Zoom:** meze ponechat 50–250 % a krokovat po 25 %. Pinch může jít plynule a ukládá se zaokrouhlený. Nové tlačítko **„Přizpůsobit šířce“** nastaví 100 % (šířka kontejneru) a vrátí scroll na začátek.
5. Zoom kontejner: `overflow: auto` vždy, když `zoom > 1`, a na iOS přidat `-webkit-overflow-scrolling: touch`. Výšku `max-h` ponechat.
- Na tahy, uložená data, export, miniatury ani PDF se nesahá. Souřadnice tahů se už dnes přepočítávají z velikosti plochy.

## Rizika
- Pinch versus kreslení: náhodný tah druhým prstem. Řeší ho zrušení tahu při druhém prstu.
- Starší stylusy hlásí `pointerType="touch"`. Uživatel si pak zapne „Kreslit prstem“, který zůstává volbou.
- Stejná mřížka slouží i učitelskému kalendáři. Seznam se proto zapne jen pod `md` a jen v denním pohledu.
- Textová pole a obrázky (přesun/změna velikosti) musí dál fungovat. Jejich `onPointerDown` se zpracuje dřív než posun.

## Testy
- Vitest `calendar-day-agenda.test.ts`: řazení podle času, termín 23:59 se zobrazí, souběžné položky nejsou vynechány.
- Vitest `notebook-gestures.test.ts`: pinch z 100 % na 200 % drží bod pod prsty (výpočet scrollu), clamp 50/250 %, „Přizpůsobit šířce“ dá 100 %, `shouldDrawPointer` beze změny pro pero.
- Playwright 390×844 s dotykem (hasTouch): v kalendáři se kartičky nepřekrývají (bounding boxy) a není vodorovné přetečení stránky. V sešitě se při 250 % po tažení prstem změní `scrollLeft/scrollTop` a nevznikne tah. Desktop 1280: mřížka beze změny.
- Typová kontrola. Bez DB, bez deploy.

## Rollback
Smazat nové soubory `CalendarDayAgenda.tsx` a `notebook-gestures.ts` a vrátit úpravy v `StudentCalendar.tsx`, `TeacherCalendar.tsx` a `NotebookCanvas.tsx`. Data nejsou dotčena.

## Otázka ke schválení
Má být na dotykových zařízeních výchozí „prst posouvá, nekreslí“ i pro uživatele, kteří „Jen pero“ nikdy nezapnuli? Doporučení: ano na telefonu, na iPadu podle uložené volby.
