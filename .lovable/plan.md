# Kontextová nápověda (otazníčky) – ostrá verze i demo

## Co už existuje (ověřeno v kódu a datech)
- **Akademie:** `/ucitel/akademie`, `/student/akademie` a `/rodic/akademie` vykresluje `AcademyView`. Kurzy a moduly jsou v `academy_courses` a `academy_modules` (např. „Jak tvořit a používat živé prezentace“ – 4 moduly, „Bezli v každodenní výuce“ – 29 modulů). **Neexistuje přímý odkaz na konkrétní kurz nebo modul.** Kurz se otevírá jen kliknutím (`openCourse`) a při otevření se zjišťuje, případně zakládá, zápis do kurzu (`academy_enrollments`).
- **Nápověda:** `/napoveda` (články, průvodci). Je to samostatná stránka, ne kontextová nápověda.
- **UI prvky:** `popover.tsx`, `tooltip.tsx` a `hover-card.tsx` (Radix). Ikona `HelpCircle` je použitá jen jednotlivě (např. `AddSlideSheet`, `LessonStudyBar`). Sdílená komponenta HelpHint/HelpTip zatím není.
- **Popupy na celé obrazovce:** Pravidlo `PortalContainerContext` (menu nad vysokými vrstvami a ve fullscreenu) se musí dodržet i u otazníčků v živé prezentaci.

## 1. Komponenta `HelpHint`
- `<HelpHint id="live.remote" />` zobrazí malý otazníček (ikona 16 px). Klikací plocha má aspoň 44×44 px, ale bez posunu rozložení: zvětšuje se průhledným okrajem a negativním marginem.
- Otazníček je tlačítko (`button`) s `aria-label="Nápověda: <název>"` a `aria-expanded`. Klik, Enter nebo mezerník otevře popover a Esc nebo klik mimo ho zavře. Focus se vrací na otazníček a obsah má `role="dialog"` s nadpisem. Nápověda se otevírá jen klikem, ne najetím myší, takže funguje i na dotyku.
- Obsah: nadpis, 1–3 věty „Co to dělá“, odrážka „Kdy použít“ a volitelné tlačítko „Zjistit víc v Akademii“. Šířka nejvýše 320 px, na 360 px displeji se popover vejde.
- Popover se vykreslí do `PortalContainerContext`, pokud existuje, aby fungoval ve fullscreenu a nad nástroji.
- Oslovení podle role: vykání pro učitele, tykání pro žáky (`variant` v registru).
- Pokud klíč v registru chybí, otazníček se nevykreslí (žádný prázdný popover) a test na to upozorní.

## 2. Centrální registr `src/lib/help-hints.ts`
```text
klíč → { title, body, when?, audience: teacher|student|both,
         academy?: { courseTitle | courseId, moduleId?, label },
         demo?: { body? , academy: "same" | "explain" } }
```
- Všechny texty jsou na jednom místě v kódu a mají jednotný formát. Test kontroluje délku textu (např. ≤ 280 znaků), povinná pole, unikátní klíče a jméno Bezli místo Zedu.
- **Odkaz do Akademie:** Akademie zatím přímé odkazy neumí. Nově bude `AcademyView` číst `?kurz=<id>&modul=<id>` a po načtení zavolá stejnou funkci `openCourse` a otevře modul. Tím se zachová stávající zápis do kurzu, nic nového se nevytváří. Bez platného id se Akademie otevře normálně.
- Doporučení: v registru odkazovat přes id kurzu a modulu (stabilní). Test přes čtecí dotaz ověří, že id existují.
- Správa textů bez programování (tabulka v databázi a editace v adminu) by vyžadovala SQL. Navrhuji ji až jako etapu 4, jen popsanou.

## 3. Kde otazníčky dávají smysl (priorita)
| Místo | Klíč | Modul Akademie (návrh) |
|---|---|---|
| Živá prezentace – lišta Nástroje | `live.tools` | Živé prezentace |
| Spustit aktivitu / Zveřejnit výsledky | `live.activity` | Živé prezentace |
| QR kód / kód hry | `live.join` | Živé prezentace |
| Dálkový ovladač (telefon) | `live.remote` | Živé prezentace |
| Zvednutá ruka a dotazy | `live.hands` | Živé prezentace |
| Adaptivní závěr | `live.adaptive` | Živé prezentace (+ varování, že „Zopakovat slabé otázky“ přepíše slidy) |
| Vkládání zdrojů a souborů (SourceInput) | `source.input` | Bezli v každodenní výuce |
| Fotky a OCR | `source.photo` | totéž |
| Bezlai (učitel i žák) | `bezlai.chat` | Jak funguje Bezli (žák a učitel) |
| Typ úkolu (úkol, materiál, oznámení) | `assign.kind` | Bezli v každodenní výuce |
| Pozdní odevzdání | `assign.late` | totéž |
| Příjemci úkolu | `assign.recipients` | totéž |
| Pracovní list – varianty A/B, tisk | `worksheet.variants` | totéž |
| Plán hodin | `plan.lesson` | totéž |
| Hodnocení a rubriky | `grading.rubric` | totéž |
| Zamčené funkce v demu | `demo.locked` | vysvětlení bez odkazu |
| Čipy limitů dema | `demo.limits` | vysvětlení |

Jedna obrazovka by měla mít nejvýše 2–3 otazníčky, vždy u nadpisu sekce nebo u tlačítka, které se vysvětluje, nikdy uvnitř formulářových polí.

## 4. Demo
- Otazníčky jsou v demu stejné.
- Odkaz do Akademie: nejdřív ověřit čtecím dotazem a v prohlížeči, zda demo učitel Akademii vidí a zda zápis do kurzu (`academy_enrollments`) projde. Demo pravidla ho neuvádějí, to jsem neověřila.
  - Projde: odkaz zůstane.
  - Neprojde: místo odkazu se zobrazí věta „Podrobný kurz najdete v Akademii v plném účtu.“ (`demo.academy = "explain"`).
- U zamčených funkcí otazníček vysvětlí, co funkce v plném účtu dělá. Napojí se na plánované hlášky „dostupné v ostrém účtu“.

## 5. Etapy a rozsah
1. **HelpHint + registr + testy** (přístupnost, chybějící klíč, validace registru). Malý rozsah, jen frontend.
2. **Živá prezentace a ovládání** (6 klíčů) a ověření ve fullscreenu, na 1280 px, 820 px a 390 px. Malý až střední rozsah.
3. **Přímý odkaz do Akademie** (`?kurz&modul`), zdroje a soubory, Bezlai, úkoly, pracovní listy, plán, hodnocení, demo. Střední rozsah, jen frontend.
4. **Volitelně:** správa textů v adminu (tabulka plus RLS pouze pro čtení přihlášenými a zápis administrátorem) – vyžaduje SQL, zatím jen popis. Případně jednoduché počítání otevření, také SQL.

## Rizika
- **Přeplnění UI:** limit 2–3 otazníčky na obrazovku a umístění jen u nadpisů. Na projektoru se otazníčky nezobrazují, jen u ovládání učitele.
- **Údržba textů:** registr na jednom místě a testy na délku a existující moduly. Při přejmenování modulu v Akademii odkaz přes id nepřestane fungovat.
- **Odkaz do Akademie:** Otevření kurzu založí zápis do kurzu, stejně jako ruční kliknutí. Učitelka tak může mít „rozpracovaný“ kurz jen díky kliknutí na otazníček.
- **Fullscreen a vysoké vrstvy:** bez portálu by se popover schoval pod živou prezentaci.
- **Srozumitelnost pro děti:** krátké texty s tykáním a pro žáky bez odkazů do učitelských kurzů.

## Otevřené otázky
- Které 3–5 míst chce majitelka v první etapě? Návrh: živá prezentace, adaptivní závěr, vkládání zdrojů, pozdní odevzdání a Bezlai.
- Kdo bude texty psát a schvalovat? Návrh: první verzi napíšu já a majitelka ji schválí.
- Má otazníček otevřít celý kurz, nebo přímo konkrétní modul (kvůli zakládání zápisu do kurzu)?
- Mají mít otazníčky i žáci a rodiče, nebo zatím jen učitelé?
- Má si učitel moci otazníčky vypnout (např. „Skrýt nápovědu“ v profilu)?
