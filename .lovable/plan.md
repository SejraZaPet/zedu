# Zarovnávací nástroje v editoru prezentace

## Co jsem zjistila (dnešní stav)

**1. Jak se ukládá pozice a velikost prvku**
- Prvek má nepovinné pole `frame` = `{ x, y, w, h }` v **procentech plochy snímku** (0–100), zaokrouhleno na jedno desetinné místo.
- Plocha snímku je pevná 1600 × 900 (16:9), takže procenta jsou jednoznačně přepočitatelná na body.
- Prvek smí přesahovat okraje (až −100 / +100 %), minimální velikost 5 %.
- Rotace se ukládá zvlášť jako vlastnost prvku ve stupních.
- Prvky **bez** `frame` zůstávají v klasickém sloupci pod sebou; do volného umístění se „povýší“ automaticky, když se s nimi táhne.

**2. Zárodek zarovnávání**
- Žádné přichytávání ani vodítka dnes neexistují — umístění je zcela volné.
- Existuje jen: posun šipkami po 1 % (se Shiftem po 5 %) a přichytávání **rotace** po 15° při držení Shiftu.
- Zarovnání „vlevo/na střed/vpravo“ v liště se týká pouze textu vnitřku prvku, ne jeho pozice na snímku.

**3. Výběr více prvků**
- Neexistuje. Editor drží jediné vybrané ID prvku; kliknutí jinam výběr přepne.

**4. Technický rámec**
- Souřadnice jsou procentuální vůči vrstvě snímku, jejíž rozměr se zjišťuje z DOM — přepočet myš → procenta už v kódu je, takže výpočet vodítek je přímočarý.
- Tažení i změna velikosti procházejí jedinou funkcí, která spočítá nový rámec; sem se dá vložit „přichytávací“ krok bez zásahu do zbytku editoru.

## Navrhované řešení

### Fáze 1 — snadné, doporučuji hned
- **Přichytávání při tažení a změně velikosti** k: levému/pravému okraji a vodorovnému i svislému středu snímku, k bezpečnému okraji (5 %), a k okrajům + středům ostatních prvků na snímku.
- **Fialová vodítka** se zobrazí jen v momentě, kdy prvek na linku „padne“ (tolerance ~1 % plochy).
- **Držení Alt** přichytávání dočasně vypne (volné umístění).
- **Přichytávání ke mřížce** (krok 1 %) při držení Shiftu.
- U rotovaného prvku se přichytávání vypne (jeho hrany nejsou vodorovné).

### Fáze 2 — středně náročné
- **Tlačítka zarovnání jednoho prvku vůči snímku**: vlevo / na střed / vpravo, nahoru / na střed / dolů, plus „vyplnit snímek“. Do plovoucí lišty vybraného prvku, jedno kliknutí = přepočet `frame`.

### Fáze 3 — větší práce
- **Výběr více prvků** (Shift+klik, tažení rámečku po prázdné ploše) — vyžaduje předělat stav výběru z jednoho ID na seznam a upravit lištu i klávesové zkratky.
- Nad ním pak **hromadné zarovnání** a **rozmístění (distribute)** s rovnoměrnými rozestupy, a společný posun všech vybraných prvků.

## Doporučení
Začít fází 1 + 2 — to pokryje většinu praktické potřeby „aby to bylo srovnané“ a nevyžaduje přestavbu výběru. Fázi 3 zařadit jako samostatný krok.
