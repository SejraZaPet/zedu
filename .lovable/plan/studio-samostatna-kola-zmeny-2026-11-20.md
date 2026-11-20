# Studio – etapa 3: plán změn samostatných kol

Schválená etapa 3; etapa 2 se neprovádí. Nasazení řeší uživatelka. Žádná migrace databáze není potřeba.

## Spuštění a kompatibilita

- Nové kroky přiřazování, řazení a doplňování mají výchozí volbu **Hrát jako samostatné kolo**. Lze zvolit **Rozložit na otázky**.
- Staré snímky Studia bez `activitySpec.soloRound` se nadále rozkládají jako dosud; jejich počet otázek se nemění. Staré hry mimo Studio se nemění.
- Popis obrázku, hotspot, třídění, kartičky, pexeso, odkrývací karty a křížovka se nově spouštějí jako jedno samostatné kolo. Osmisměrka a krátká odpověď nemají samostatného hráče a zůstávají jen v pracovním listu.
- Výsledek je jeden řádek ve stávajícím `game_responses`; JSON `answer` obsahuje počet správných položek a jejich výsledky, ne správné řešení. Tabulka, sloupce ani RLS se nemění.

## Čas a průběh

- Přednastavený čas: 15 s za položku; kartičky a odkrývací karty 8 s, hotspot 12 s. Zaokrouhlení nahoru na 5 s, minimum 45 s, maximum 300 s. Učitel čas změní nebo vypne.
- Projektor během kola ukazuje zadání bez řešení, odpočet, „Pracujte na telefonu“ a `X z N hotovo`.
- Telefon používá stávající hráče aktivity v režimu bez předčasné kontroly, náhodných řešení a opakování. Odeslání je jedno; po něm „Čekejte na ostatní“. Při vypršení se odešle aktuální stav včetně prázdných položek.
- Učitel ukončí kolo dřív přepnutím na výsledky. Po skončení se žákovi ukáže jeho výsledek. Správné řešení je výchozí zapnuté a lze ho u kroku vypnout.

## Serverové bodování

- Server načte původní zadání vlastní sady podle `sourceTemplateId` a `slideId`, ověří odevzdané volby a spočítá `správné položky / všechny položky`. Klientské `score`, `isCorrect`, `correctCount` a čas se pro výsledek nepoužijí.
- Kartičky a odkrývací karty hodnotí dokončené položky; pexeso nalezené dvojice; křížovka celá správná slova. Ostatní typy hodnotí jednotlivé dvojice, pozice, mezery, popisky nebo zásahy.
- Standard a Věž: `1000 × podíl × body kroku`; Závod: `10 × podíl × body kroku`; Krádež: `100 × podíl × body kroku`. Body kroku jsou 0/1/2. Zaokrouhlení na celé body.
- Rychlost se nikde nepočítá. Krádež bodů u kola nekrade, nestrhává za chybu a nepoužívá sérii. Věž u kola používá stejné procentuální body jako standard, aby částečný výsledek nezanikl.
- Závod zůstává vlastním tempem žáka: samostatné kolo je jedna pozice na dráze, s vlastním odpočtem od otevření; společné ukončení kola učitelem a společný projekční odpočet se v Závodu nepoužijí. Ostatní režimy mají společné tempo učitele.
- Týmový výsledek kola je průměr bodů připojených členů, neodeslaný člen se počítá s 0. Celkové týmové skóre zůstává průměr na člena jako dosud.

## Výsledky a sestavovač

- Projektor po kole ukáže průměrnou úspěšnost třídy (neodeslaní jako 0), nejčastěji chybné položky, žebříček s body přidanými za kolo a případně týmový průměr. Řešení se ukáže až ve stavu výsledků.
- Souhrn sady rozlišuje `X běžných otázek + Y samostatných kol` a odhad doby. Bez limitu se odhad označí jako otevřený.
- U „Z lekce“ je počet 1–12 výslovně limitem AI kroků. Převzatí hotových aktivit je samostatná volba (výchozí ne) s vlastním omezením 1–24.

## Testy a neověřitelné

- Čisté testy ověří 0/částečné/všechno/neodeslané, serverové hodnocení všech typů, režimy, týmy, statistiky, kompatibilitu rozpadu, adaptéry, počty a odhad.
- Regrese: live-game-core, live-game-expand, game-scoring, live-timing, game-session-sync.
- Dva telefony, projektor, zátěž a ostré nasazení se touto změnou neověřují.

## Stav provedení

- Hotovo bez migrace i nasazení; serverová funkce je změněná jen ve zdrojovém kódu a pro ostrý běh čeká na nasazení uživatelkou.
- Cílené testy: 128 logických/regresních + 4 komponentové + 1 stávající vstup z lekce. Typy a sestavení náhledu prošly. Celá sada: 1345/1352; 7 starých chyb v `classroom-people-source` a `lesson-study-bar` se změny netýkají.
- Uložená sada „Hovězí maso“ byla ověřena jen čtením: 24 kroků, přiřazování 7+5+4+4, starý popis obrázku a žádný příznak `soloRound`. Přímé spuštění staré sady proto zůstává historicky rozložené; po otevření v sestavovači lze čtyři přiřazování přepnout na kola a popis obrázku se při uložení změní v páté samostatné kolo.
