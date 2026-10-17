# Dokončení ligy a naplnění dema ukázkami

## Diagnostika
- Liga má nové XP události, denní strop, opakování, série, týdenní skupiny, uzavření týdne, odznaky a záložku Liga. Sedm testů čistých pravidel prošlo. Starý dvouparametrový `add_xp` deleguje na nové zabezpečené bodování, takže strop neobchází.
- Zbývá bezpečnostní dluh původního třídního žebříčku: `class_leaderboard` vrací celé pořadí; aplikace navíc načítá jména spolužáků a anonymizuje je až při zobrazení. Liga proto není uzavřena jako plně ověřená.
- Aktuálně je 5 demo párů, 2 sdílené ukázkové učebnice a 0 herních šablon těchto demo učitelů.
- Moje učebnice měly filtr pouze na vlastníka. Detail navíc četl strukturu předmětu místo lekcí připojených přímo k ukázkové učebnici.
- `demo_seed_pair` nyní zakládá úkol a pokusy, nikoli hry. Opakované volání může zdvojit úkoly. Knihovna her dovoluje číst jen vlastní šablony.
- Snapshot/reset dosud nezahrnuje hry. Úklid musí respektovat vazby her, šablon a párů; nelze spoléhat jen na obecnou smyčku mazání.

## Již provedené změny pouze v aplikaci
- Moje učebnice využívají existující demo filtr: vlastní obsah + sdílené `is_demo_seed` učebnice. Běžné účty mají dál pouze vlastní obsah.
- Ukázky nesou štítek „Ukázková učebnice“, nemají nabídku úprav/mazání/přesouvání a detail načítá pouze jejich vlastní lekce do náhledu ke čtení.
- Databáze a demo ochrany nebyly změněny. Ověření pod demo účtem ještě není dokončeno.

## 1. Nejprve dokončit ligu
- Přidat nový bezpečný RPC pro třídní žebříček bez změny podpisu stávající funkce: top 10 + vlastní pozice, jméno podle nastavení, anonymita na serveru, oprávnění a demo izolace.
- Zapojit jej ve žákovském pohledu místo přímého načítání jmen, všech XP a baseline spolužáků.
- Prověřit všechny dostupné funkce žebříčku a přístupy k detailům, aby stará cesta nemohla nový limit obejít; omezit starý RPC pro žáky bez změny oprávnění učitelů a správců.
- Ověřit ligu a soukromí na syntetických [TEST] žácích, potom odstranit pouze vlastní testovací data. Neměnit nastavení skutečných škol ani přepočítávat XP.

## 2. Potom ukázkové hry dema
- Každý demo učitel dostane vlastní tři šablony: „Ukázka: Výživa – kvíz“ (5 českých otázek), „Ukázka: Výživa – Pravda/Nepravda“ (6 výroků) a „Ukázka: Výživa – spojování dvojic“.
- Použít běžný formát her a stávající převod na samostatné otázky. Každé spuštění vytvoří vlastní relaci návštěvníka; žádné sdílené živé relace.
- Samostatná idempotentní pomocná funkce vytvoří jen chybějící ukázky. Doplnění stávajících párů nebude znovu volat současné zakládání úkolů.
- Při novém vstupu se pomocná funkce zavolá z `demo_seed_pair` v jedné transakci; žádné AI ani vzdálené generování při vstupu.
- Doplnit všechny existující páry bez smazání nebo přepsání jejich vlastní tvorby.
- Zdrojové definice ukázek uchovat ve snapshotu odděleně od kopií návštěvníků. Reset obnoví zdroje a doplní chybějící kopie, nikdy nevzkřísí smazané páry.
- Zkontrolovat noční úklid šablon i spuštěných relací přes vazby na pár; sdílené zdroje zůstávají. Bez duplicit po opakovaném doplnění/resetu.

## Technické změny vyžadující schválení
- Aditivní migrace bezpečného třídního RPC a omezení staré žákovské cesty, bez změny uložených XP.
- Aditivní značení ukázkových šablon stabilním klíčem a vazbou na demo pár, unikátní kombinace pár + druh ukázky.
- Zdrojové definice ukázek v aplikačním úložišti se snapshot/reset podporou; explicitní GRANT a RLS u případné nové tabulky, zdroje přístupné pouze serveru.
- Pomocná funkce dostupná jen serveru; úzké změny `demo_seed_pair`, resetu a úklidu.
- Ponechat vlastnické RLS šablon; případné nové demo politiky pouze RESTRICTIVE s `is_demo_user()`, `demo_iso` a `demo_guard_*`. Žádná výjimka dovolující návštěvníkům přístup k jinému páru.
- Obsah zdrojových ukázek a doplnění stávajících párů vložit datovým dotazem po migraci, ne samostatnou datovou migrací.

## Rizika a ověření
- Největší rizika: zdvojení úkolů při doplnění, přepsání tvorby návštěvníka, obnovení smazaného páru resetem a neúplný úklid. Omezit zápisy stabilními klíči a explicitními vazbami.
- Testovat opakované doplnění, reset, původní obsah a izolaci dvou demo párů přes skutečné oprávnění.
- V náhledu jako demo učitel: obě učebnice → lekce → náhled; knihovna → ukázkový kvíz → [TEST] hráč → odpověď → projektor s jednou otázkou → ukončení → úspěšnost třídy v %.
- Kontrolovat konzoli a síť; uklidit jen vlastní [TEST] účty, hry a odpovědi. Ukázkové šablony zůstávají pro návštěvníky.
- Závěr: co funguje, způsob doplnění starých párů, ruční kontrola nového vstupu i pokračování na bezli.cz/demo. Zveřejnění není součástí tohoto kroku.

**Před migracemi a změnou demo_seed_pair čekám na schválení tohoto plánu.**