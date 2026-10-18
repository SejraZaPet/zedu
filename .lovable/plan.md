# Jednorázové výjimky: překážka před napojením učitelského rozhraní

## Stav
Schválena je pouze učitelská etapa bez migrace. Kontrola pouze čtením odhalila, že hotové funkce a oprávnění tento rozsah nesplňují. Napojení obrazovek je zastavené; žádná migrace ani testovací zápis nebyly provedeny. Stálý rozvrh, kalendáře a cizí data nebyly změněny.

## Ověřené překážky
- `save_schedule_exception` při zdroji `class_slot` nastavuje `visible_to_students = true` i při `_share = false`. Samotné skrytí žákovského rozhraní nezabrání dostupnosti záznamu přes existující čtení.
- Politika `schedule_exceptions_read` dovoluje čtení zveřejněné výjimky i jinému učiteli stejné třídy/skupiny. To odporuje požadovanému ověření, že jiný učitel výjimku nevidí.
- Politika `schedule_links_read` dovoluje žákům čtení vazeb zveřejněných plánů nezávisle na soukromosti samotné výjimky.

## Návrh úzké databázové opravy — není schválený
Případný samostatný souhlas by se vztahoval pouze na:
1. Úpravu `save_schedule_exception`, aby nové nebo upravené výjimky v této učitelské etapě zůstaly soukromé (`visible_to_students = false`), bez změny ostatní logiky funkce.
2. Omezení běžného čtení `schedule_exceptions` a `schedule_plan_occurrence_links` na vlastníka. Stávající RESTRICTIVE demo politiky a granty 0065 zachovat; servisní přístup neměnit.

Soukromé poznámky již mají čtení jen pro vlastníka. Žádné přepisování existujících dat, změny základního rozvrhu, dalších tabulek, dávky, trvalé změny ani živé nástroje Etapy B nejsou součástí návrhu. Přesné SQL předložit před provedením. Po případném selhání neopakovat migraci bez konzultace.

## Pokračování až po vyřešení překážky
- Učitelský kalendář a Dnes: jednorázový přesun/zrušení/návrat, důvod a soukromá poznámka; sloučení výjimek až při zobrazení.
- Připojené plány číst přes doplňkové vazby; obsah ani původní rozvrh nepřepisovat. Před napojením ověřit dostupné chování nepřiřazení, další hodiny a návratu; chybějící možnosti oznámit, nikoli obcházet.
- Varování před kolizí s potvrzením učitele; český čas včetně odmítnutí neexistujícího či nejednoznačného času.
- Testy logiky a přihlášená zkouška výhradně na vlastních nových `[TEST]` demo účtech: přesun, zrušení, návrat, plán, kolize, čas a odmítnutí cizího čtení/zápisu. Uklidit jen vlastní testovací data.

## Žáci a zprávy — samostatná budoucí etapa
Vyžadují výslovné schválení pravidel zveřejnění, bezpečného čtení podle členství, napojení žákovských kalendářů a volitelného odesílání současným systémem oznámení. Soukromé poznámky neposkytovat. Nyní nic z toho neimplementovat.

## Rollback
Rozhraní zatím není napojené, takže aktuálně není co vypínat. Budoucí vypnutí učitelského ovládání nevymaže výjimky ani nepřepíše stálý rozvrh. Soukromá oprávnění nevracet na širší čtení bez výslovného souhlasu.