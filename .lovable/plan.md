# Dočasné změny rozvrhu – diagnostika a návrh ke schválení

**Stav:** pouze čtení aplikace a struktury databáze. Žádný aplikační kód, data, oprávnění ani migrace nebyly změněny. Předchozí práce na nástrojích a demu je v roadmapě dokončená; Etapa B živých nástrojů zůstává neschválená. Tento plán nic nezveřejňuje.

## 1. Co existuje dnes

### Dva odlišné rozvrhy
- **Osobní rozvrh:** `teacher_schedules` má `user_id` (primární klíč), `data` JSON, `created_at`, `updated_at`. JSON obsahuje vyučovací hodiny, časy zvonění, přestávky, seznamy společných/lichých/sudých týdnů a režim týdnů. Hodina má vlastní `id`, den, pořadí hodiny, předmět, volitelnou třídu (`classId`), místnost, `validFrom`/`validTo`, paritu a případný `mirrorKey` dvou kopií. Nemá samostatnou vazbu na skupinu. Účetní kopie je v databázi; localStorage je cache s historickým fallbackem. Není to stejný zdroj jako rozvrh třídy.
- **Rozvrh tříd/skupin:** `class_schedule_slots` má stabilní `id`, právě jednu z vazeb `class_id` / `group_id`, `day_of_week` 1–7, `start_time` / `end_time`, `week_parity` every/odd/even, `valid_from` / `valid_to`, `created_by`, předmět (`subject_id` i starší text), místnost a volitelné odkazy na učebnici, zvonění a školní zdroj. Databáze kontroluje cílovou vazbu XOR, konec po začátku a pořadí platnosti.
- A/B dnes odpovídá **lichému/sudému ISO týdnu**, nikoli školou nastavenému střídání A/B. Platnost od–do je včetně obou krajních dnů.

### Kde se zobrazují
| Obrazovka | Dnešní zdroj a chování |
|---|---|
| Kalendář učitele | Spojuje třídní/skupinové hodiny a osobní rozvrh; úkoly a osobní úlohy přidává samostatně. |
| Kalendář žáka | Třídní/skupinové hodiny dostupné přes současná oprávnění; zveřejněné úkoly a osobní úlohy zvlášť. |
| „Dnes“ učitele/žáka | Rozvíjí `class_schedule_slots` pro dnešní datum; osobní JSON rozvrh dnes nepřidává. |
| Rozvrh učitele | Osobní rozvrh i oprávněné třídní/skupinové hodiny. |
| Rozvrh žáka a rodičovský přehled | Týdenní šablona podle členství, nikoli konkrétní datovaný týden; žák má filtr parity. |
| Rozvrh třídy / Hodiny z mých tříd | Editace nebo přehled opakujících se hodin, nikoli výjimek konkrétního týdne. |
| Výběr termínu plánu a exporty | Vycházejí ze základního rozvrhu, bez výjimek. |

Kalendáře používají společné `expandScheduleSlots`; osobní zdroj má `expandTeacherSchedule`. Některé dotazy spoléhají na RLS, jiné výslovně filtrují členství. Stejná osobní a třídní hodina nemá společné ID; automaticky je spojovat podle názvu/času by bylo nebezpečné.

### Plány, zrušení a prázdniny
- `lesson_plans` ukládá vlastníka, třídu/skupinu, obsah a zveřejnění. `linkedDate`, `linkedTime`, `linkedSlots` jsou v `input_data`: datum, čas a cílová třída/skupina, **bez stabilního ID zdrojové hodiny**. Staré jedno přiřazení a více přiřazení se čtou vedle sebe.
- Fázový přehled je navíc v `lesson_plan_phases`: učitel, předmět, datum, začátek/konec a fáze. `lesson-phase-plans.ts` jej skutečně ukládá do databáze; komentář v editoru o lokálním uložení je zastaralý. Část těchto řádků nemá `lesson_plan_id`; shoda předmět + datum + čas nemusí být jednoznačná.
- Nebyla nalezena tabulka výjimek ani funkce, která by v těchto cestách rušila/přesouvala jednotlivé hodiny.
- `school_calendar_events` a `staff_calendar_events` jsou běžné události, včetně celodenních/opakovaných. Nemají ověřený typ „svátek/prázdniny“ a jejich zobrazení výuku nevynechává. Nadpis události nesmí sloužit jako automatické pravidlo.

## 2. Doporučené chování

### Přesun
- **Jen tentokrát:** z detailu datované hodiny vybrat nové datum a čas; původní termín zůstane označen „Přesunuto na …“, nový „Přesunuto z …“. Výuka a připojený plán jsou jen v novém termínu.
- **Dočasně od–do:** vybrat období původních hodin a nový den/čas. Před uložením ukázat všechny jednotlivé přesuny, vynechané dny a konflikty. Platnost a parita se vyhodnotí podle původní hodiny; přesun do jiného ISO týdne její výskyt nezruší. Pokud původní nebo cílový den není vyučovací, řádek se přeskočí a zobrazí proč; nic se samo neposouvá na jiný den. Jedna dávka dovolí úpravu i vrácení celku.
- **Trvale od data:** doporučuji **později**. U třídních hodin lze ukončit staré pravidlo a vytvořit navazující platnost, ale osobní JSON, zrcadlené A/B hodiny a staré plány potřebují bezpečné verzování. To už mění základ, nikoli výjimku, a vyžaduje samostatné schválení.

### Zrušení a návrat
- Jedna hodina nebo období od–do: vybrané vlastní hodiny, třídy/skupiny, dny týdne a důvod; před uložením přesný seznam dotčených termínů. Listopad znamená jen vybraný listopad, ne každý listopad.
- Vrácení jedné změny či celé dávky obnoví základní výskyt bez přepisování rozvrhu. Již upravené řádky jiné dávkou nepřepsat; zobrazit konflikt a vyžádat rozhodnutí.
- Při kolizi s vlastní výukou, hodinou cílové třídy/skupiny nebo dostupnou rezervací místnosti ukázat varování; učitel může potvrdit. Nepřístupné rozvrhy neodhalovat ani tvrdit, že žádná kolize neexistuje. Přesun automaticky nemění rezervaci místnosti.

### Viditelnost a zprávy
- Osobní pohled vždy ukazuje účinné změny. U skutečné třídní/skupinové hodiny doporučuji **automatickou viditelnost členům**; jinak učitel a žáci uvidí různé rozvrhy.
- U změny pouze osobního JSON rozvrhu je výchozí stav soukromý. Sdílení je možné jen po ověření oprávněné cílové třídy a výslovném potvrzení; pouhý napsaný název nestačí. Skupinu osobní zdroj zatím nezná.
- „Zrušeno“ / původní přesunutý termín nesmí být započítán jako další výuka ani nabídnut pro spuštění plánu. Nový termín se zobrazí normálně s označením přesunu.
- Zpráva třídě/skupině jen volitelné nezaškrtnuté pole, současným systémem zpráv/oznámení. Důvod pro žáky oddělit od soukromé poznámky učitele.
- Týdenní šablony zůstanou šablonami; doplnit datovaný pohled „Tento týden“, ne vydávat trvalý rozvrh za listopadové výjimky.

### Plán následuje konkrétní výskyt
- Nová přiřazení dostanou zdroj a původní datum. Účinný termín se odvodí z výjimky; obsah, fáze, nástroje a podmínky zveřejnění se nemění.
- Staré vazby dopárovat pouze při jednoznačné shodě; při více kandidátech učitel vybere, ručně datované plány se automaticky nehýbou. Hromadné přepisování `input_data` není součástí návrhu.
- Při zrušení nabídnout „Nepřiřazený“ / „Použít v další hodině“. Další hodina = následující nezrušený vyučovací výskyt stejného zdroje; ukázat datum a případně obsazený plán. Neobsadit jej bez potvrzení.
- Přesunout jen dotčené přiřazení vícekrát použitého plánu. Návrat obnoví původní vazbu, pokud ji mezitím učitel nezměnil; jinak vyžádá rozhodnutí. Staré fázové souhrny řešit společným čtením, nikoli nebezpečným mazáním podle času.

## 3. Technický návrh a bezpečnost (až po schválení)

- **`schedule_exceptions`:** ID, vlastník učitel, zdroj (`class_slot`/`personal`), `class_slot_id` nebo osobní ID hodiny a identita seznamu/zrcadlení, původní místní datum, typ cancelled/moved, nové datum/začátek/konec, oprávněný cíl, veřejný důvod, soukromá poznámka, `batch_id`, stav aktivní/vrácená, revize a časy změn. Zrcadlené osobní hodiny potřebují logickou identitu odvozenou z `mirrorKey`, ne dvojí výjimku.
- **`schedule_exception_batches`:** vlastník, typ, rozsah, filtry a pravidlo přesunu, revize. Je to označení dávky, nikoli kopie rozvrhu.
- **`schedule_plan_occurrence_links`:** vlastník, plán, zdroj + původní datum, stav přiřazení a případné explicitní přesměrování po zrušení. Doplní stabilní vazbu bez přepsání starých plánů; žádné cizí plány ani nové zveřejnění.
- **Dny bez výuky:** pro dávky je nutný autoritativní školní kalendář. Navrhuji samostatné rozsahy `school_non_teaching_periods` (škola, od–do, typ, územní působnost, ověřený zdroj), spravované školou. České svátky a prázdniny ověřit pro školní rok a okres, zejména jarní prázdniny. Bez nastavení nepředstírat automatické vynechání; dávku nepovolit, dokud není kalendář potvrzen. Běžné školní události nezmění význam.
- Spojení až při čtení: základ → konkrétní výskyty → výjimky → účinné vazby plánů. Dotaz hledá **původní NEBO nové datum v intervalu**, jinak přesun z minulého měsíce zmizí. Přesun zůstává identitou původního výskytu, nikdy se rekurzivně neaplikuje na cílové datum.
- Atomické serverové operace pro uložení/úpravu/vrácení dávky a změnu vazeb; kontrola revize a opakování požadavku bez duplikace. Ověřit existenci původního výskytu a neměnit zdroj, vlastníka či třídu podvrženým požadavkem.
- Jedna aktivní výjimka na zdroj a původní datum: oddělené částečné unikátní indexy pro DB a osobní zdroj; další indexy vlastník+původní datum, vlastník+nové datum, cíl+obě data, dávka, plán+výskyt. Kontroly cílového XOR, typu, platného rozsahu, času a souladu dávky/vlastníka.
- **RLS:** zápis/úprava/vrácení jen vlastník se serverově ověřeným přístupem ke zdroji; spolu-učitel nesmí měnit cizí výjimku. `created_by` u starých DB hodin může být NULL a současná pravidla umožňují více učitelů: nepřivlastňovat je automaticky. Nejednoznačné vlastnictví před spuštěním výslovně vyřešit, jinak výjimku nenabídnout.
- Žáci čtou jen zveřejněné změny svých aktuálních tříd/skupin. Soukromá poznámka ani osobní rozvrh se neposkytne: bezpečný výstup s vybranými sloupci, ne SELECT celé tabulky s pouhou RLS. Vazby plánů a dávky jsou pro vlastníka; dny bez výuky čtou členové školy, zapisuje oprávněný správce školy.
- **GRANT:** každá nová public tabulka musí dostat výslovné granty ve stejné migraci před RLS/politikami. Pro auth jen nutná čtení; zápisy atomickými RPC s kontrolou vlastníka, `service_role` pro údržbu. `anon` žádný přístup. Definer funkce s pevným search_path, kontrolou auth.uid(), cíle a omezeným EXECUTE.
- **Demo:** současné RLS je zapnuté; na kontrolovaných tabulkách rozvrhů/plánů nejsou vlastní pojmenované `demo_iso`/`demo_guard_*` politiky. To samo nedokazuje únik: přístup závisí také na chráněných třídách/členství a vlastnících. Nové tabulky však musí mít od začátku additive RESTRICTIVE izolaci a ochranu zápisů pomocí existujících helperů, včetně kontroly páru v RPC. Sdílené ukázky neměnit; nové záznamy vlastnímu páru, reset/purge pouze k němu. Staré politiky neuvolňovat.

## 4. Dopady, testy a rollback

**Beze změny:** základní rozvrh, obsah/generování/ukládání plánů, lekce, hry, XP, hodnocení, pokusy, úkoly a jejich termíny, termíny testů, viditelnost obsahu, rezervace i živé nástroje Etapy B. Při přesunu lze upozornit na související test/úkol, nikdy automaticky posunout deadline.

**Testy:** nulové výjimky = stejné dnešní výsledky; jednorázový přesun/zrušení/návrat; dávky s krajními daty, konflikty a souběžnými úpravami; A/B, ISO týden 53 a přelom roku; původní/nový termín mimo zobrazovaný interval; osobní zrcadlené hodiny; třída/skupina; jednoznačné i nejednoznačné staré plány; více vazeb a návrat bez ztráty pozdějších úprav; svátek 17. 11. a ověřené regionální prázdniny. Časová zóna Europe/Prague, místní datum/čas, ne UTC řez toISOString: přechody 29. 3. a 25. 10. 2026, týdenní čas 08:00 stále 08:00; neexistující/nejednoznačný čas vyžaduje odmítnutí či explicitní volbu. Dávku negenerovat přičítáním 168 hodin.

**Bezpečnost a aplikace:** cizí vlastník, podvržený zdroj/cíl, žák bez členství, soukromá poznámka, anonym; dvě oddělená dema a sdílený seed; učitelský i žákovský kalendář, Dnes, datovaný rozvrh, plány a exporty po obnovení relace. ICS potřebuje EXDATE/RECURRENCE-ID, nebo omezený export účinných výskytů; dnešní UTC RRULE bez výjimek by byl zavádějící. Neslibovat automatickou aktualizaci již staženého kalendáře.

**Rollback:** nejprve pilot a vypínač nové funkce; návrat UI/čtení k základu není smazání dat. Výjimky ponechat pro obnovu/export, upozornit, že jejich účinek je vypnutý. Nové tabulky ani vazby nedestruktivně neodstraňovat; nevratné zprávy již odeslané třídě nelze odvolat. Čistit jen vlastní `[TEST]` data.

## 5. Etapy a doporučení
1. **Jednorázové změny:** bezpečné vlastnictví/identity, výjimky, stabilní vazba plánu, přesun/zrušení/návrat, osobní a žákovské datované zobrazení, testy a pilot. Migraci nejdřív předložit ke schválení.
2. **Období a dávky:** ověřený kalendář bez výuky, dočasné přesuny, zrušení období, úprava/vrácení celku, volitelná zpráva a korektní exporty. Nezapínat neúplné exporty v etapě 1.
3. **Trvalá změna:** až zvláštní návrh verzování stálého rozvrhu, ne součást první realizace.

**Doporučení:** schválit nejprve etapu 1; etapu 2 doplnit po potvrzení školního kalendáře a pilotu. Žádná etapa nyní není implementována ani migrována.
