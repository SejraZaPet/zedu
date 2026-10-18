# První etapa: schválení změn databáze pro jednorázové přesuny a rušení

## Připraveno a ověřeno
- Izolované výpočty v `schedule-exceptions.ts`: jednorázový přesun, zrušení, návrat, původní a nový termín, stabilní identita hodiny, vazba plánu a kolize.
- 17 nových testů, všech **557 testů prošlo**. České časy ověřeny i při použití z jiného časového pásma, včetně přechodů 29. 3. a 25. 10. 2026.
- Žádná změna stávajících obrazovek, ukládání rozvrhu nebo databáze. Funkce zatím není dostupná uživatelům. Nebyla vytvořena žádná testovací data v databázi.

## Rozsah migrace ke schválení
Přidat pouze tabulky a funkce první etapy. Žádné přepisování existujících rozvrhů, plánů či oprávnění.

### Nové tabulky
1. **`schedule_exceptions`** — jednorázová změna: ID, vlastník, druh zdroje, ID třídní hodiny nebo logické ID osobní hodiny, původní datum, zrušení/přesun, nové datum a čas, stav aktivní/vrácená, revize, ověřená třída/skupina, viditelnost, veřejný důvod a časy změn.
2. **`schedule_exception_notes`** — soukromá poznámka ve zvláštní tabulce, přístupná výhradně vlastníkovi; žák ji nedostane ani přes čtení veřejné změny.
3. **`schedule_plan_occurrence_links`** — doplňková vazba vlastního plánu na zdroj a původní datum; při zrušení nepřiřazení nebo potvrzená další hodina. Nezmění obsah, zveřejnění ani staré údaje plánu.

Dávky a školní kalendář bez výuky nyní nevytvářet. Trvalé změny ani živé nástroje Etapy B neimplementovat.

### Kontroly a indexy
- Oddělené unikátní indexy zajistí jednu aktivní výjimku na zdroj a původní datum; revize chrání před přepsáním souběžné změny.
- Indexy původního/nového data, vlastníka, třídy/skupiny a plánu pro datované čtení.
- Kontroly správného zdroje, cíle a typu; přesun vyžaduje datum i oba časy a konec po začátku.
- Na serveru ověřit, že původní výskyt skutečně existuje v platnosti a paritě zdrojové hodiny. Osobní identitu ověřit proti vlastnímu účtu a zrcadlené hodiny svázat logickým klíčem.

### Funkce
- Oprávněné čtení změn podle původního **nebo nového** data v rozsahu, aby přesun z jiného měsíce nezmizel.
- Atomické uložení/úprava/vrácení změny a vazby plánu; kontrola vlastníka, přístupu ke zdroji, revize a opakovaných požadavků.
- Žákovský výstup obsahuje pouze veřejnou změnu pro vlastní třídu/skupinu; nikdy osobní rozvrh, poznámky ani obsah cizích plánů.

## Oprávnění a demo
- Každá nová veřejná tabulka dostane výslovný GRANT, poté RLS a politiky v jedné migraci. `anon` žádný přístup; přihlášení jen nutné čtení, zápisy přes ověřující funkce; servisní role pro údržbu.
- Funkce s pevným `search_path`, omezeným EXECUTE a ověřením `auth.uid()`. Role zůstávají v existujícím chráněném systému.
- Výjimku mění jen vlastník. U třídního zdroje vyžadovat současné oprávnění i jednoznačné vlastnictví; `created_by IS NULL` ani cizí vlastník se automaticky nepřivlastní.
- Ověřené demo helpery `demo_can_see_class`, `demo_can_see_group`, `demo_can_see_owned` a `is_demo_user` doplnit additive RESTRICTIVE politikami. **Samotné `demo_can_see_owned` není dostatečné**, dovoluje také běžné vlastníky: u demo uživatele explicitně omezit nová data na vlastní pár přes `demo_visible_user_ids`, stejně i v zapisujících funkcích.
- `demo_guard_*` dovolí jen vlastní nové změny a ověřený párový cíl. Žádné uvolnění starých politik, zásah do sdílených ukázek nebo cizího obsahu. Úklid nových záznamů navázat pouze na vlastní pár.

## Co následuje po schválení
1. Připravit a aplikovat tuto aditivní migraci; ověřit granty, oprávnění, jedinečnost a dvě oddělená dema.
2. Zapojit „Přesunout“, „Zrušit“, „Vrátit“ do datovaného detailu učitele, kalendářů a Dnes; zrušený/původní přesunutý termín nezapočítávat jako výuku.
3. Připojený plán následuje zdrojový výskyt; staré vazby dopárovat jen jednoznačně nebo po výběru učitele. Nedotýkat se generování, ukládání obsahu ani termínů úkolů/testů.
4. Ověřit přihlášenou cestu přesun → uložení → obnovení → žákovské zobrazení → návrat; jen vlastní `[TEST]` data. Výjimky nezapínat v exportu, dokud není správný.

## Rollback
Vypnout nové ovládání a čtení; původní rozvrh zůstal nedotčený. Nové tabulky a vazby ponechat pro obnovu, nic destruktivně nemazat. Vypnutí zruší účinek výjimek a musí být učiteli zřetelné.

**Schválení tohoto plánu dovolí migraci a dokončení první etapy. Dávky, trvalé změny a Etapa B zůstávají mimo rozsah. Nic nebylo zveřejněno.**