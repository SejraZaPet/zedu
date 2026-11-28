# Plán: „Zvednutá ruka“ do menu Nástroje

Jen návrh. Nic se nenasazuje; AGENTS.md, databáze, RLS ani SQL se nemění. Změna by byla čistě ve frontendu.

## Zjištěný stav
- Tlačítko je `src/components/game/RaisedHandsIndicator.tsx`: plovoucí `fixed bottom-4 right-4 z-50`, zobrazí se jen když se někdo hlásí („Hlásí se N“), v okně seznam s „Odbavit“ (RPC `clear_player_hand`, beze změny).
- V `LiveTeacherScreen.tsx` se vykresluje v čekárně (ř. 614) a při promítání/ovládání (ř. 800).
- Překrývá ho kulaté tlačítko **„Přidat slide“** (+) na téže obrazovce: `fixed bottom-6 right-6 z-50`, 56 px. Obě jsou vpravo dole se stejnou vrstvou, takže se kryjí.
- Menu „Nástroje“ je v `src/components/live/LiveTeacherActions.tsx` (horní lišta, ikona klíče). Už dnes má červený odznak s počtem nezodpovězených dotazů a položku „Dotazy“.

## Návrh
1. Odebrat plovoucí `RaisedHandsIndicator` z režimu promítání/ovládání (ř. 800).
2. Do `LiveTeacherActions` předat `raisedHands` (seřazené přes stávající `sortRaisedHands`).
3. V menu Nástroje v sekci „Výsledky a spolupráce“ nahoru položka „Zvednuté ruce“ s počtem. Klik otevře stejný seznam s „Odbavit“ (vyčlenit obsah okna do sdílené komponenty `RaisedHandsList`, aby logika zůstala na jednom místě). Bez hlášení: položka „Zvednuté ruce (nikdo)“, neaktivní.
4. Odznak na tlačítku Nástroje: součet = zvednuté ruce + nezodpovězené dotazy, nebo raději dva odlišené odznaky (ruka žlutá s ikonou, dotazy červené), aby šlo poznat, co se děje. Odznak má `aria-label` „Hlásí se N“, `aria-live="polite"` zůstává (čtečka ohlásí novou ruku).
5. Aby učitel nepřehlédl první ruku: krátké pulzování odznaku při změně 0 → 1 (respektuje `prefers-reduced-motion`), bez zvuku.
6. Čekárna (ř. 614): tam lišta s Nástroji není – ponechat plovoucí tlačítko, ale posunout ho, aby nekolidovalo (např. vlevo dole), nebo také do horní lišty čekárny. Volbu nechat na otázce níže.
7. Kompaktní zobrazení (telefon/tablet, `compact`): stejná položka v rozbalené nabídce; odznak vpravo jako u Dotazů.
8. Test: čistá funkce pro text/počet odznaku (0, 1, více; ruce + dotazy) a render testu menu, že položka „Zvednuté ruce“ zobrazí jména a „Odbavit“ volá RPC (mock).
9. Ověření v prohlížeči (mock data): 1280×720, 1600×900, 390×844 – nic se nepřekrývá s „Přidat slide“, odznak viditelný, „Odbavit“ odebere jméno.

## Rizika
- Ruka schovaná v menu je méně nápadná než plovoucí tlačítko – proto odznak a pulz.
- Fullscreen/nástrojová vrstva: menu musí portálovat přes `PortalContainerContext` (stávající pravidlo), jinak by bylo pod vrstvou.
- Projektor ani žákovská obrazovka se nemění.

## Otevřené otázky
1. „Pro nový slide“: myslela tím tlačítko **„Přidat slide“** (+), které ruku překrývá, nebo chce, aby hlášení fungovalo stejně i na nově vloženém slidu, nebo něco v editoru? Nehádám.
2. Jeden společný odznak (ruce + dotazy), nebo dva oddělené?
3. Má i čekárna přesunout ruku nahoru, nebo stačí posunout plovoucí tlačítko jinam?
