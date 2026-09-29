# Prezentace z lekce: bezpečné ukládání a věrnější vizuál

## Cíl
Nejdřív odstranit ztrátu ručních úprav při obnovení prezentace z lekce. Potom zlepšit převod a vykreslení lekčních bloků tak, aby se zachovaly jejich typy, barvy, hierarchie a čitelnost bez tichého ořezu.

## Část A — ukládání a slučování

1. **Zapojit existující merge do skutečného toku aplikace**
   - `usePresentationLauncher` při otevření editoru i spuštění nejprve vytvoří čerstvé snímky z aktuální lekce.
   - Načte učitelovu propojenou prezentaci z `teacher_presentations`; pro starší záznamy použije jako záložní zdroj `lesson.presentation_slides`.
   - Čerstvé a uložené snímky spojí přes `mergePresentationSlides` a stejný výsledek použije editor i projektor.
   - Ruční úpravy se budou ukládat do učitelovy propojené kopie; tím se úpravy globální lekce nepromíchají mezi učiteli.

2. **Zpevnit párování snímků**
   - Primární klíč bude `sourceBlockId` bez dělicích přípon.
   - Přípona/pořadí části bude druhotný klíč; nadpis zůstane pouze kompatibilní fallback pro starší data.
   - Nespárované ručně přidané nebo dříve upravené snímky se zachovají, neodstraní.

3. **Zachovat všechny ruční zásahy**
   - `editedByTeacher` bude nadále označovat změny obsahu a stylu bloku.
   - Přesun, odstranění a další strukturální změny označí snímek jako ručně upravený, aby merge neobnovil smazaný blok nebo původní pořadí.
   - Přidám explicitní metadata pro smazané zdrojové bloky / ruční pořadí v JSON snímku; databázová migrace není potřeba.

4. **Dokončit zámek snímku**
   - Existující ovládání přejmenuji na jasné „Neaktualizovat z lekce“ / „Znovu aktualizovat z lekce“.
   - `lockedFromLesson` zachová celý uložený snímek beze změny.
   - Zámek bude funkční po zavření, znovuotevření i přímém spuštění projektoru.

## Část B — věrnější převod a čitelnost

5. **Zachovat bloky a jejich lokální vzhled**
   - `blocks-to-slides` bude předávat původní typ a props pro `callout`, `two_column`, `image_text`, `gallery`, tabulky, karty a další podporované bloky.
   - `backgroundStyle` a `backgroundColor` zůstanou u každého bloku; barva celé skupiny se použije jen jako pozadí snímku.
   - Kontrast se vyhodnotí samostatně pro každý blok ve flow i ve volném layoutu.

6. **Zachovat hierarchii nadpisů**
   - h1/h2 mohou vytvořit titulek snímku.
   - h3/h4 zůstanou mezititulkem uvnitř těla včetně vlastního podbarvení.
   - U případu „Koleno“ se tedy fialový h3 nevyjme z karty a nepovýší na holý titulek snímku.

7. **Rozdělit přeplněné strukturované skupiny**
   - Hustotu nebudu určovat jen počtem znaků; započítám typ bloku, obrázky, počet odrážek, tabulky, galerie a sloupce.
   - Běžné `slide_group` rozdělím na navazující snímky po celých blocích a zachovám jejich pořadí i typ.
   - U dlouhého jednotlivého textového/callout/list bloku rozdělím obsah na pokračování se stejným vizuálním typem.
   - Volný layout nebude dělen naslepo tak, aby se rozbily souřadnice. Při překročení čitelné plochy se rozdělí do stabilních prostorových skupin; původní rámce se na každé části normalizují.
   - Runtime zmenšení zůstane jen do čitelného minima; obsah pod tímto limitem musí být rozdělen už generátorem, nikoli oříznut.

8. **Sjednotit renderovací pravidla, ne násilně oba layoutové komponenty**
   - Lekce je scrollovatelný dokument, zatímco prezentace je editovatelné pevné plátno s drag/resize. Přímé nahrazení `SlideCanvas` komponentou `LessonBlockRenderer` by rozbilo editor.
   - Vytáhnu/reuse společné renderovací části a utility pro typ bloku, pozadí, typografii a kontrast; `SlideCanvas` si ponechá pouze prezentační rámec, editaci a 16:9 layout.
   - Editor, projektor a PDF budou dostávat stejná normalizovaná data a používat stejný prezentační renderer včetně fallback bloků a lesson režimu.

## Ověření

- Unit testy pro merge v reálném launcher flow: ručně změněný blok, změna nadpisu, jiné rozdělení na části, smazání/přesun, ručně přidaný snímek a zámek.
- Fidelity testy pro h1–h4, více barev, callout, dvousloupec, image+text, celou galerii a strukturované dělení.
- Regresní test přímo podle produkční struktury karty „Koleno“: obrázek + fialový h3 + dvě odrážky, bez ztráty stylu a bez ořezu druhé odrážky.
- Vizuální kontrola stejné prezentace v editoru, projektoru a PDF; ověřím i znovuotevření po uložení.

## Rizika a ochrany

- **Starší uložené prezentace bez zdrojových ID:** použije se fallback párování a nespárovaný obsah se zachová; nic se automaticky nemaže.
- **Změna počtu částí jednoho zdrojového bloku:** části se párují deterministicky podle základního ID a pořadí; přebytečné ručně upravené části zůstanou zachované.
- **Mazání a přesouvání:** samotné `editedByTeacher` na blocích nestačí, proto budou strukturální zásahy evidované na snímku.
- **Free layout:** automatické dělení může změnit relativní kompozici; omezím je na skutečné přetečení a pokryji samostatnými testy rámců.
- **Dva rozdílné renderovací kontexty:** nesloučím celý dokumentový a canvas renderer do jedné komponenty; sdílím jen vizuální primitiva, aby zůstala inline editace, drag/resize, aktivity a export.
- **Globální lekce:** učitelské úpravy se nebudou zapisovat jako společná globální data; kanonická ruční verze bude učitelova propojená prezentace.
