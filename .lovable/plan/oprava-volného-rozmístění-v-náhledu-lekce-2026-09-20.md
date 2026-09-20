# Oprava volného rozmístění v náhledu lekce

## Co změním
- Pouze v needitovatelném `FreeFrameCanvas` změřím skutečnou výšku obsahu každé karty při aktuální šířce.
- Pokud obsah potřebuje více místa než uložený rámec, kartu zvětším; uložená data ani editor se nezmění.
- Karty ve stejné řadě nebo pod zvětšenou kartou posunu dolů tak, aby se zachovalo vodorovné rozložení a nevzniklo překrytí.
- Výšku celého plátna prodloužím podle výsledného rozmístění; obsah už nebude oříznutý.

## Technické provedení
- Měření proběhne po vykreslení a při změně šířky přes `ResizeObserver`, včetně pozdějšího načtení obrázků či fontů.
- Posuny budu počítat po vizuálních řadách podle původních souřadnic `y`; růst jedné karty určí výšku celé řady, takže sousední karty zůstanou zarovnané.
- Editovatelná varianta s `onChangeFrame` zůstane beze změny.

## Ověření
- Doplním testy pro růst karty, posun stejné/následující řady a zachování editorového chování.
- Ověřím sestavení a náhled konkrétní lekce s textem „Zajistit, aby se potraviny vzájemně…“, pokud je dostupná v přihlášeném náhledu.
