# Plán: tlačítko „Zvednutá ruka“ bez překryvů a s upozorněním jako u dotazů

Jen návrh. Nic se nenasazuje; AGENTS.md, databáze, RLS ani SQL se nemění. Změna čistě ve frontendu. Ruka zůstává samostatné viditelné tlačítko (nezalézá do menu Nástroje). Otázka „pro nový slide“ se zatím neřeší.

## Zjištěný stav
- Ruka: `src/components/game/RaisedHandsIndicator.tsx`, plovoucí `fixed bottom-4 right-4 z-50`, viditelná jen při hlášení („Hlásí se N“), okno se seznamem a „Odbavit“ (RPC `clear_player_hand`). Vykreslená v `LiveTeacherScreen.tsx` v čekárně (ř. 614) a při ovládání (ř. 800).
- Překrývá ji tlačítko „Přidat slide“ (+), `fixed bottom-6 right-6 z-50`.
- Dotazy žáků dnes (`useLiveQuestions` v `LiveQuestionsSheet.tsx`): data přes RPC `get_session_questions` + živé změny + dotaz každých 5 s. Učitel je vidí **jen** jako červený odznak s počtem na tlačítku „Nástroje“ a v položce „Dotazy“; seznam se otevírá v bočním panelu, kde jde dotaz označit jako zodpovězený.
- **Dotazy dnes nemají vyskakovací upozornění ani zvuk.** Notifikace „stejně jako u dotazů“ tedy v aplikaci zatím neexistuje – navrhuji ji vytvořit jednou a použít pro obojí.

## Návrh
### 1. Umístění tlačítka ruky
- Tlačítko „Hlásí se N“ přesunout do horní lišty obrazovky učitele, hned vedle (vlevo od) lišty akcí `LiveTeacherActions`, jako běžné tlačítko v toku lišty (ne `fixed`), takže nic nepřekrývá a lištu neposouvá přes jiné prvky. Bez hlášení se nezobrazí (lišta se nemění).
- Na úzkém displeji (`compact`): ikona ruky s číslem v liště; text „Hlásí se“ jen od šířky sm.
- Čekárna: tlačítko do hlavičky čekárny vedle kódu hry, ne vpravo dole.

### 2. Společné upozornění pro dotaz i ruku
- Nová komponenta `LiveAttentionToasts` (jedna pro obě události): při nové zvednuté ruce nebo novém dotazu ukáže v pravém horním rohu pod lištou (mimo „Přidat slide“) kartu:
  - ruka: „✋ Petr se hlásí“ + tlačítka „Vzít na vědomí“ (= Odbavit, stejné RPC) a „Zavřít“;
  - dotaz: „❓ Nový dotaz od Petra: …(zkráceno)“ + „Otevřít dotazy“ a „Označit zodpovězené“ (stávající akce).
- Detekce „nového“ jen porovnáním s předchozím stavem v paměti (id hráče s `hand_raised` / id dotazu); první načtení stránky upozornění nespouští.
- Víc událostí najednou: max 3 karty, další shrnout „+2 další“. Karta zmizí sama po 15 s, ale tlačítko v liště s počtem zůstává.
- Zvýraznění: krátké pulzování tlačítka ruky / odznaku Nástroje (respektuje omezení animací). Zvuk: volitelný krátký tón, výchozí vypnutý, přepínač v „Nastavení prezentace“ (localStorage), protože dnes žádný zvuk není.
- Přístupnost: `role="status"`, `aria-live="polite"`, tlačítka min. 44 px, ovladatelné klávesnicí, portál přes `PortalContainerContext` (fullscreen / nástroje).
- Soukromí: na obrazovce učitele jméno ano; projektor ani žáci upozornění nevidí. Anonymní režim použije stávající `anonymousLabels`.

### 3. Sjednocení logiky
- Čistá funkce `diffAttentionEvents(prev, next)` vrací nové ruce a dotazy; používá ji `LiveAttentionToasts`. Test: první načtení bez událostí, nová ruka, odbavená ruka znovu zvednutá, nový dotaz, více současně, anonymní jména.
- `RaisedHandsIndicator` se rozdělí na tlačítko do lišty + sdílený seznam (stávající „Odbavit“ beze změny).

### 4. Ověření
- Prohlížeč s maketami (bez zápisů): 1280×720, 1600×900, 390×844 – tlačítko ruky v liště nic nepřekrývá, „Přidat slide“ volné, karta upozornění se ukáže při nové ruce i dotazu, „Vzít na vědomí“ ruku odebere.

## Rizika
- Horní lišta je na telefonu plná – nutná kontrola, aby se tlačítko vešlo (případně jen ikona).
- Ruce se načítají přes živé změny hráčů; při výpadku spojení upozornění přijde až po obnovení.
- Zvuk v prohlížeči může být blokovaný, proto výchozí vypnutý.

## Otevřené otázky
1. Má být zvuk zapnutý ve výchozím stavu, nebo jen na přání?
2. Mají karty zmizet samy (15 s), nebo zůstat do kliknutí?
3. (Odloženo) „pro nový slide“ – čeká na upřesnění majitelky.
