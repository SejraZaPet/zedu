# Demo jako ukázka – kvóty počtu položek (doplněk plánu)

## Co demo omezuje už dnes (zůstává beze změny)
- Soubory: 20 ks a 2 MB na soubor (`demo_config`, kontroluje `demo_storage_upload_ok` při nahrání do úložiště).
- AI: 25 dotazů na účet a 1 500 denně pro všechna dema dohromady (`demo_config`, hlídá `_shared/demo-ai-guard.ts`). Pruh dema už ukazuje „AI generování: zbývají X z 25“ (`get_my_demo_limits`, `DemoBanner`).
- Vznik dema: limit na IP adresu za hodinu a celkový denní limit. Pro akci „dalkove-ucitele“ platí od 27. do 29. 11. vyšší limity: 80 dem z jedné IP za hodinu, 1 000 denně, 15 AI dotazů na účet a 1 000 AI dotazů denně. Tento dočasný přepis se se stálými kvótami nemíchá.
- Ostatní: zápisy jsou omezené, jednotlivá dema jsou od sebe oddělená a ukázkový obsah je jen ke čtení.
- Počet vytvořených položek dnes neomezuje nic.

## Navržené kvóty na jednu demo dvojici (učitel + ukázkový žák)
Čísla stačí na celý postup: učebnice → lekce → prezentace/aktivita → živá hra → úkol → odevzdání žákem.

| Kvóta | Limit | Počítá se |
|---|---|---|
| Vlastní učebnice | 2 | `teacher_textbooks` vlastníka, kopie ukázek také |
| Lekce | 10 | `teacher_textbook_lessons` ve vlastních učebnicích |
| Prezentace | 5 | `teacher_presentations` |
| Pracovní listy | 5 | `worksheets` |
| Aktivity/hry | 10 | `teacher_game_templates` bez ukázkových (`demo_seed_key IS NULL`) |
| Úkoly/materiály | 10 | `assignments` |
| Třídy/skupiny | 2 | `classes` + `subject_groups` |
| Žáci | 1 (ukázkový žák) | demo nemůže přidávat další žáky, tím se zabrání sběru cizích údajů |
| Živé hry současně | 1 aktivní, 10 celkem | `game_sessions` |
| Nahrané soubory | 20 ks / 2 MB (stávající) | beze změny |
| AI dotazy (generátory i Bezlai) | 25 (stávající) | Bezlai by mohla mít vlastní podlimit 15 z těchto 25, viz otevřené otázky |

Hodnoty se uloží do nastavení (nový sloupec `quotas` v `demo_config`), aby šly měnit bez nového nasazení. Dočasný přepis pro akci limity pouze zvyšuje, nikdy nesnižuje.

## Kde se kontroluje
- **Server (skutečná ochrana):** Vyžaduje SQL, proto zde jen popis. Do každé z výše uvedených tabulek se přidá trigger `BEFORE INSERT` s funkcí `demo_quota_ok(tabulka)` typu SECURITY DEFINER, která pro demo uživatele spočítá jeho řádky a při dosažení limitu vrátí chybu s kódem `DEMO_QUOTA:<klíč>`. Trigger se pro ne-demo uživatele vrací hned na prvním řádku, takže jejich oprávnění zůstávají beze změny (stejný princip jako `demo_guard_*`). RESTRICTIVE policy by šla také, ale počítání v policy je pomalé a vrací jen obecné „permission denied“. Trigger proto vrátí srozumitelný kód.
- **Edge funkce:** Žádná nová kontrola. Funkce, které zakládají obsah (např. kopie učebnice, AI tvorba listu nebo prezentace), zapisují do stejných tabulek a trigger je zachytí. Pouze se v nich chyba `DEMO_QUOTA` přeloží na stav 409 se srozumitelnou hláškou.
- **Frontend (pohodlí, ne ochrana):** `get_my_demo_limits` vrátí i nové klíče s počty (vyžaduje SQL úpravu funkce). Nový pomocník `useDemoQuota(key)` vypne tlačítko „Vytvořit“ a předem zobrazí hlášku. Globální zachytávač chyb (rozšíření `installDemoLimitWatcher`) chybu `DEMO_QUOTA` převede na stejnou hlášku i tam, kde tlačítko vypnuté není.
- **Bez SQL** jde jen frontendové upozornění a počítání na straně prohlížeče. To je obejitelné, proto se samo o sobě nedoporučuje.

## Co uživatel uvidí
- Hláška při dosažení limitu, ve vykání, protože demo používá učitel: „V ukázce můžete mít nejvýše N učebnic. V plném účtu bez omezení.“ a tlačítko „Vytvořit plný účet“ (stávající převod demo-prevod-na-ostry-ucet).
- Pro žákovskou část demo pouze zobrazí informaci ve stylu tykání.
- Pruh dema: kompaktní čipy „Učebnice 1/2 · Lekce 4/10 · Prezentace 2/5 · AI 7/25“. Na šířce 390 px se zobrazí jen čipy blízko limitu (od 80 %) a zbytek se skryje pod „Další limity“. Čip na limitu je červený a pruh se nesmí sbalit (stávající `mustStayExpanded`).
- Smazání položky uvolní místo, protože se počítají existující řádky.

## Postup
1. Schválit čísla a podlimit pro Bezlai.
2. SQL balíček ke schválení (zatím jen soubor v `supabase/proposals/`): `quotas` v `demo_config`, `demo_quota_ok`, triggery, rozšíření `get_my_demo_limits` a postup pro vrácení změn.
3. Frontend: čipy v pruhu, `useDemoQuota` u tlačítek vytvoření a přeložení chyby. Přidat testy na hlášky a výpočet.
4. Edge funkce: překlad chyby `DEMO_QUOTA` na stav 409.
5. Ověření na demo dvojici: dosažení každého limitu a kontrola, že běžný učitel limity nemá.

## Rizika
- Trigger na velkých tabulkách přidá ke každému vložení jednu kontrolu. Pro ne-demo uživatele je to jen rychlé `is_demo_user`. Je potřeba změřit.
- Ukázkový obsah a kopie: rozhodnout, zda se kopie ukázkové učebnice počítá. Návrh: počítá se.
- Hromadné akce (kopie učebnice s lekcemi) mohou skončit v půlce. Kopírovací funkce proto musí předem zkontrolovat, že se celá kopie vejde.
- Stávající dema mohou mít už teď víc položek než nový limit. Nic se jim nesmaže, jen nebudou moci přidávat další.

## Otevřené otázky
- Platí navržená čísla? Jsou 2 učebnice a 10 lekcí dost na ukázku pro školu?
- Má mít Bezlai vlastní podlimit v rámci 25 AI dotazů, nebo sdílet jeden?
- Mají limity platit na celou dvojici (učitel + žák dohromady), nebo jen na učitele?
- Mají se kvóty při akcích zvyšovat stejně jako AI limity?
