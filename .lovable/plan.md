# Kontextová editace položek pracovního listu

## Cíl
Ponechat A4 plátno jako věrný náhled výsledku, ale po kliknutí na položku zobrazit její úpravy přímo u bloku. Pravý panel bude obsahovat pouze nastavení celého pracovního listu. Datový formát, typy položek, skórování a způsob ukládání přes `WorksheetEditor.updateSpec` zůstanou zachované.

## Návrh interakce
- Kliknutí na blok jej zvýrazní a otevře ukotvený plovoucí editor vedle bloku, podobně jako vlastnosti v editoru lekce.
- Samotný blok zůstane tiskovým náhledem; formulář se nevloží dovnitř stránky, takže nezmění výšku položky ani A4 stránkování.
- Krátké editory budou vidět rovnou. Typy s mnoha poli dostanou kompaktní sekce **Obsah**, **Odpověď a hodnocení** a **Vzhled a média**; rozbalená bude vždy jen potřebná část.
- Panel bude mít omezenou výšku a vlastní posun. Na užší obrazovce se stejný obsah otevře jako spodní panel, aby nepřekryl celý list.
- Horní lišta bloku zachová přesun, pořadí, dokončení a smazání. Klik mimo blok nebo „Hotovo“ editor zavře.

## Implementace
1. **Jeden sdílený editor vlastností**
   - Vyčlenit současnou logiku `PropertiesPanel` do jedné znovupoužitelné komponenty pro všechny typy položek.
   - Odstranit její vykreslování z pravého panelu a napojit ji na kontextový panel vybraného bloku.
   - Zachovat všechny existující handlery pro položku i klíč odpovědi; každá změna dál projde přes `updateItem` / `updateAnswerKey` a tím přes `updateSpec`.
   - Sloučit dnes duplicitní implementace `TypeSpecificEditor` a `PropertiesPanel`, aby existoval jediný seznam polí a další změny se nemusely dělat dvakrát.

2. **Rozložení rozsáhlých typů**
   - Tabulky, párování, řazení a komplexní aktivity dostanou širší variantu panelu navázanou na šířku A4 obsahu.
   - Běžná metadata (čas, obtížnost, body) budou v kompaktní řádce; správné odpovědi, média, odkaz, tiskový prostor a AI úpravy budou v pojmenovaných skládacích sekcích.
   - Pravý panel zůstane dostupný pouze pro předmět, ročník, režim, pokyny, poznámky učitele a QR kódy záhlaví.

3. **Tabulka na živém A4 plátně**
   - Upravit náhled tabulky tak, aby využil celou dostupnou šířku stránky a sloupce rozděloval podle dostupného prostoru a obsahu.
   - Editor buněk zobrazit v široké kontextové variantě: běžné 2–4 sloupce vyplní šířku panelu; vodorovný posun se použije až u většího počtu nebo skutečně dlouhého obsahu.
   - Zachovat stávající `tableRows`, přidávání/mazání řádků a sloupců i automatický import tabulek z lekce.

4. **Jediné nastavení řádků pro `write_lines`**
   - Za jedinou uživatelskou hodnotu považovat počet řádků; styl čáry zůstane samostatně.
   - Potvrzené paralelní hodnoty `item.lineCount` a `item.answerSpace.lineCount` číst kompatibilně, ale při úpravě je synchronizovat a výšku tiskového prostoru odvodit automaticky.
   - Pro `write_lines` skrýt obecnou sekci „Prostor pro odpověď (tisk)“ a nevykreslovat pod vlastními linkami druhý obecný prostor. Ostatní typy si obecné nastavení odpovědního prostoru ponechají.
   - Doplnit kompatibilní normalizaci starších listů bez databázové migrace, aby se jejich počet řádků po otevření nezměnil.

5. **Stabilita A4 a přístupnost**
   - Kontextový panel vykreslit mimo měřenou výšku položky, aby jeho otevření nepřehazovalo položky mezi stránkami.
   - Doplnit správu fokusu, zavření klávesou Escape, popisky ovládání a klávesovou obsluhu.
   - Zachovat stávající tiskový/PDF renderer; upravit pouze sjednocené čtení počtu řádků tam, kde je to nutné pro shodu náhledu a tisku.

## Ověření
- Přidat testy pro kompatibilní sjednocení `write_lines`, shodu náhledu/tisku a nezměněné stránkování při otevření editoru.
- Ověřit tabulku se 2, 3, 4 a více sloupci, přidání/odebrání buněk a dlouhý obsah.
- V prohlížeči projít reprezentativní jednoduché i rozsáhlé typy, mobilní panel, přetahování, undo/autosave a následný tisk/PDF.
- Nakonec zkontrolovat sestavení a kompletní testovací sadu.

## Rizika a jejich omezení
- **Největší riziko je duplicita editorů:** dnes jsou pole implementovaná na dvou místech. Nejprve vznikne jedna sdílená komponenta, teprve potom se změní její umístění.
- **Paginace:** inline formulář by měnil měřenou výšku bloku. Proto bude editor plovoucí a mimo tok A4 stránky.
- **Starší `write_lines`:** oba uložené údaje se mohou lišit. Kompatibilní čtení zachová dosavadní vizuální počet a další ruční změna oba údaje bezpečně synchronizuje.
- **Rozsáhlé editory:** nebudou se cpát dovnitř bloku; použijí širší panel se sekcemi a vlastním posunem.
