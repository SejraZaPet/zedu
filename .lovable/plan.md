# Závěrečné vyhodnocení živé hry

## Co se změní

- Žák po skončení hry dál uvidí své skóre a umístění v oslavném vzhledu. Pod výsledkem přibude osobní souhrn ve dvou částech: správně zodpovězené otázky a otázky k procvičení.
- Učitel po skončení hry dostane dvě záložky: stávající pódium a nový „Přehled otázek“.
- Přehled seřadí zodpovězené otázky od nejnižší úspěšnosti, ukáže počet odpovědí a barevný pruh podle stejné škály jako stávající statistika obtížnosti.
- U otázky s úspěšností pod 50 % bude „Vytvořit hru na tohle“. Otevře existující Rychlou hru na AI záložce s předvyplněnou otázkou a naměřenou úspěšností.

## Technické řešení

- Rozšířit společnou závěrečnou komponentu o režim žáka/učitele. Žákovský souhrn se odvodí pouze z odpovědí aktuálního `player_id`; učitelský přehled ze všech `game_responses` aktuální session.
- Pro názvy použít jednotný pomocný převod, který umí běžné kvízové otázky i otázky uložené uvnitř `activitySpec`; nevyhodnotitelné prezentační snímky se do přehledu nezařadí.
- Zachovat aktuální pódium, týmové pořadí, konfety a návratové akce. Nové části budou čitelné na mobilu i projektoru a budou používat stávající barevné tokeny.
- Znovu použít `QuickGameDialog`, `weakSpotGameTopic` a hranici `< 50 %`; bez nového datového modelu a bez změny ukládání odpovědí.

## Ověření

- Přidat cílené testy výpočtu osobního souhrnu, pořadí obtížnosti, hranice 50 % a různých formátů otázky.
- Ověřit sestavení a kompletní testovací sadu.
- Pokud půjde bezpečně vytvořit testovací relaci na účtu, nasimulovat správné i chybné odpovědi, zkontrolovat žákovskou kartu i učitelské záložky a testovací data odstranit.
