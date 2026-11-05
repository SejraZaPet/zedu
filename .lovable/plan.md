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
