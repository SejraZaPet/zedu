# Zeď třídy jako stream a nový název záložky „Úkoly“ – diagnostika a návrh

Jen diagnostika. Kód, databáze ani e-maily se nemění, dokud nenapíšete „schvaluji“.

## Co Zeď dnes umí
- Zeď **nemá vlastní data**. Skládá se z položek, které stránka už načetla z úkolů třídy nebo skupiny: úkolů, materiálů i oznámení.
- Nahoře je blok „Oznámení“ se třemi posledními oznámeními, připnutá jsou první. Pod ním je seznam všech položek od nejnovějších a po 10 se načítají další.
- U položek jsou komentáře podle pravidel z databáze. Učitel u nich zapíná a vypíná komentáře a moderuje je, žák má „Zeptat se učitele“ přes Zprávy.
- **Psát na Zeď nejde.** Nový obsah se zakládá jen v editoru úkolů tlačítkem „Přidat“ v podzáložce.
- **Kdo smí obsah vkládat (ověřeno čtením oprávnění):** vložit úkol smí jen ten, kdo ho zakládá sám za sebe a smí zadávat dané třídě nebo skupině (učitel, spolupracovník, admin). **Žák vkládat nesmí.**
- **Upozornění:** zveřejnění pošle žákům upozornění. Jeho nadpis je podle druhu („Nový úkol / materiál / oznámení:“), neznámý druh dostane nadpis „Nový úkol:“. E-mail se řídí volbou `notifyEmail`. Když chybí, e-mail dostane úkol i oznámení, materiál ne.

## 1) Volný příspěvek jako oznámení – jde to bez změny databáze?
**Ano.** Příspěvek učitele uložíme jako oznámení s příznakem, že jde o příspěvek. Druh zůstane „oznámení“, takže:
- Zobrazí se v podzáložce Oznámení i na Zdi jako jedna a táž položka, žádný duplikát.
- Platí pro něj stejné komentáře, výběr „Pro koho“ (ale u oznámení ho dnes nenabízíme, viz níže) i stejná oprávnění.
- **Výchozí bez e-mailu.** Žák dostane jen upozornění v aplikaci, e-mail pouze když učitel zaškrtne „Poslat e-mailem“. Hromadné e-maily tak nepřijdou nečekaně.
- Na Zdi se ukáže jako „Příspěvek“, v podzáložce Oznámení s malým štítkem.

Nový samostatný druh „Příspěvek“ nedoporučuji. Upozornění by ho nadepsala jako „Nový úkol:“ a musela by se změnit databázová funkce, což je zbytečné riziko.

## 2) Návrh vzhledu a ovládání
**Pole „Sdílej něco s třídou…“ nahoře na Zdi (jen učitel).** Po kliknutí se rozbalí jednoduchý editor:
- Text (stejný formát jako popis oznámení) s počítadlem znaků.
- Přílohy a odkazy (stávající přílohy úkolů).
- **Komu:** celá třída nebo skupina z aktuální stránky, předvyplněno.
- Volby „Připnout“, „Povolit komentáře“ (zapnuto) a „Poslat e-mailem“ (vypnuto).
- Tlačítka **Zveřejnit** a **Zrušit**. Na šířce 390 px pod sebou, každé vysoké nejméně 44 px a bez posunu do strany.

**Tlačítko „Přidat ▾“ vedle pole s volbami Úkol / Materiál / Oznámení / Příspěvek:**
- Úkol, Materiál a Oznámení otevřou stávající editor s předvyplněnou třídou nebo skupinou, předmětem a druhem (`?kind=` už editor umí) a s návratem zpět na Zeď.
- Příspěvek otevře rozbalovací editor přímo na Zdi.
- Po uložení se položka objeví ve správné podzáložce i na Zdi (stejný záznam).

**„Pro koho“:**
- U úkolů a materiálů zůstává tak, jak je dnes.
- U příspěvků a oznámení je výběr žáků dnes podle Vašeho dřívějšího rozhodnutí vypnutý. Volba „vybraní žáci“ by u příspěvku znamenala změnit toto rozhodnutí. Databáze to už umí, šlo by jen o úpravu aplikace.

### Žáci a vlastní příspěvky
**Varianta A – píše jen učitel (doporučuji teď).**
- Žádná změna databáze ani oprávnění.
- Žáci se dál zapojují komentáři.

**Varianta B – i žáci, s volbou „Povolit žákům příspěvky“ u třídy nebo skupiny.**
- Žák nesmí zakládat úkoly a nesmí to ani začít smět. Proto by žákovské příspěvky potřebovaly vlastní novou tabulku příspěvků se samostatnými pravidly. Úkolům by se otevírat nedalo.
- Pravidla: číst může jen třída nebo skupina; psát smí žák jen tam, kde je členem a kde je volba zapnutá; denní limit; učitel může příspěvek skrýt nebo smazat.
- Bez e-mailů, bez příloh a bez připínání.
- Zeď by pak spojovala dva zdroje.
- Je to větší zásah s rizikem obtěžování spolužáků, proto doporučuji až později.

## 3) Nový název hlavní záložky
Místa, kde se název používá:
- Učitel: stránka předmětu nebo třídy, `TeacherSubjectClass.tsx` řádek 1440 („Úkoly (n)“).
- Žák: stránka předmětu, `StudentSubjectClass.tsx` řádek 682.
- Podzáložka „Úkoly“ (`AssignmentKindTabs`, `?sekce=ukoly`) a komentář v `assignment-kind.ts`.
- Testy `AssignmentKindTabs.test.tsx`.
- Vnitřní označení záložky je `assignments` a nemění se, takže stávající odkazy fungují dál.
- Hlavní stránka „Úkoly“ (`/ucitel/ulohy`) je jiná stránka a měnit se nemusí.
- V nápovědě jsem zmínku nenašla. Ověřím ji ještě jednou před úpravou.

Kandidáti:
1. **„Zadání“** – krátké a vystihuje úkoly, materiály i oznámení. Doporučuji.
2. „Obsah“ – krátké, ale obecné; plete se s obsahem učebnice.
3. „Úkoly a materiály“ – vynechává oznámení a na telefonu je dlouhé.
4. „Třída“ – nejasné na stránce, která už je stránkou třídy.
5. „Práce“ – krátké, ale nesedí na oznámení.

Doporučuji **„Zadání (n)“**, kde n je počet všech položek. Podzáložky pod ní zůstanou Úkoly | Materiály | Oznámení s vlastními počty. Na šířce 390 px se vejde vedle „Průběh“ a „Výsledky“.

## 4) Co jde bez změny databáze
- **Bez změny databáze:** název záložky, pole na Zdi a tlačítko „Přidat ▾“, příspěvek jako oznámení s příznakem, výchozí bez e-mailu, předvyplnění a návrat.
- **Se změnou databáze:** jen Varianta B (žákovské příspěvky). Jen návrh, nespouštět:

```sql
CREATE TABLE public.wall_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid, group_id uuid, author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  hidden_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((class_id IS NULL) <> (group_id IS NULL)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_posts TO authenticated;
GRANT ALL ON public.wall_posts TO service_role;
ALTER TABLE public.wall_posts ENABLE ROW LEVEL SECURITY;
-- politiky: čtení členové + učitelé; vkládání jen člen, author_id = auth.uid(),
-- a volba allowStudentPosts u třídy/skupiny; skrývání jen učitel; RESTRICTIVE demo_iso;
-- trigger s limitem (např. 10 za den).
-- Volba u třídy/skupiny: nový sloupec allow_student_posts boolean DEFAULT false.
-- Rollback: DROP TABLE public.wall_posts; ALTER TABLE ... DROP COLUMN allow_student_posts;
```

## 5) Etapy
1. **Přejmenování na „Zadání“** u učitele i žáka a úprava testů.
2. **Pole „Sdílej něco s třídou…“ a tlačítko „Přidat ▾“.** Soubory:
   - `ClassWall.tsx`
   - nový `WallComposer.tsx`
   - `class-wall.ts` a `assignment-kind.ts` (příznak příspěvku, výchozí bez e-mailu)
   - `TeacherSubjectClass.tsx` (předání třídy, skupiny a předmětu)
   - `TeacherAssignments.tsx` (předvyplnění a návrat)
3. **Varianta B jen po zvláštním schválení databáze.**

**Rizika**
- Příspěvek uložený přímo ze Zdi musí projít stejnými pravidly jako editor. Uložení použije stejný postup koncept → zveřejnit, aby se nic neobešlo.
- Starší příspěvky bez příznaku se dál zobrazí jako oznámení.
- E-mail se pošle jen po zaškrtnutí.
- Na Zdi žáka se pole nezobrazí.

**Testy**
- Příspěvek se uloží jako oznámení s příznakem a bez e-mailu.
- Na Zdi i v podzáložce se objeví jedna položka.
- Žák pole na Zdi nevidí.
- Název záložky „Zadání“ a beze změny `?sekce=`.
- Předvyplnění z „Přidat ▾“.
- Po každé etapě proběhnou testy, kontrola typů a sestavení. Pak kontrola na šířce 390 px.

## Na čem se rozhodnout
1. Název záložky: „Zadání“ (doporučuji), nebo jiný?
2. Žáci: jen učitel (A, doporučuji), nebo i žáci (B, vyžaduje schválení databáze)?
3. Mají příspěvky ve výchozím stavu chodit bez e-mailu (doporučuji)?
4. Povolit u příspěvků a oznámení výběr „vybraní žáci“?
5. Které etapy schválit (doporučuji 1 a 2)?
