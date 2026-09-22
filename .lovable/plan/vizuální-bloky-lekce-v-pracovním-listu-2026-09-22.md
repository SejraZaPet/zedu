# Vizuální bloky lekce v pracovním listu

## Co doplním
- Přidám do pracovního listu čtyři needitovatelné typy: obrázek, obrázek + text, galerii a zvýrazněný rámeček.
- Každý typ ponese data potřebná pro věrný přenos: popisky a šířku obrázku, stranu kombinovaného bloku, počet sloupců galerie a variantu či vlastní barvu rámečku.
- Zachovám stávající formát pracovních listů; nové údaje budou volitelné, takže staré listy zůstanou funkční.

## Vzhled a zobrazení
- Přidám společný needitovatelný renderer pro žákovský náhled se stejnými poměry a variantami jako v lekci.
- Doplním odpovídající tiskové/PDF vykreslení, bezpečné escapování textu a pravidla proti nevhodnému dělení bloků mezi stránky.
- Layoutové bloky nebudou číslované, bodované ani zahrnuté do navigace a hodnocení žáka; zobrazí se jako kontext u následující úlohy.

## Přenos ze „Sekcí lekce“
- Rozšířím extrakci sekcí o chronologický seznam vizuálních bloků, včetně bloků uvnitř karet.
- Data namapuji přímo ze zdrojových polí lekce: `url/width/alignment`, `imageUrl/imagePosition/text`, `images/columns`, `calloutType/title/text/backgroundStyle/backgroundColor`.
- Panel označí, jaké vizuální prvky sekce obsahuje, a při vytvoření listu je automaticky vloží na původní místo bez nové volby.
- Tabulky, vizuální bloky a aktivita/poznámky budou vloženy podle skutečného pořadí v sekci, ne pouze po skupinách typů.

## Technické detaily
- Rozšířím `WorksheetItem`, JSON schema, výchozí položky, názvy typů a registry rendererů.
- Doplním editorové zobrazení nových bloků jako read-only náhled; jejich obsah se bude měnit pouze novým přenosem ze zdrojové lekce.
- Sjednotím mapování variant rámečku s lekcí (`note/info`, `tip/remember`, `warning`) a zachovám vlastní barvu pozadí, pokud je uložená.

## Ověření
- Přidám testy extrakce a pořadí pro běžné i vnořené bloky a testy webového i tiskového vykreslení.
- Ověřím editor, žákovský náhled a PDF na lekci „Úvod maso“; pokud v ní některý typ chybí, použiji další dostupnou lekci nebo přesnou testovací sestavu.
- Zkontroluji sestavení, cílené testy a stav živého náhledu na počítači i mobilní šířce.