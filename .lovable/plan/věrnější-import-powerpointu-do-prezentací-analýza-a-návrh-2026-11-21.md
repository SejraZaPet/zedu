# Věrnější import PowerPointu do prezentací – analýza a návrh

Jen návrh. Nic se nemění, nenasazuje, bez změn databáze.

## 1. Jak je dnes slide modelovaný
- Slide je volné JSON v `teacher_presentations`: `type`, `projector {headline, body, fontScale}`, `device {instructions}`, `blocks[]`, `layout`, `heroImage`, `themeId`, `teacherNotes`.
- **Pozadí už existuje:** `backgroundOverride` = obrázek / barva / přechod `{from, to, direction}` (jen 2 barvy). Vykresluje se centrovaně „contain" na plátně 1600×900.
- **Absolutní pozice už existuje:** každý blok může mít `frame {x, y, w, h}` v % plátna a `zIndex`. Bloky s rámem vystoupí z toku. Bez rámu platí vertikální tok podle `layout`.
- **Bloky:** nadpis, odstavec, odrážky, obrázek, `shape` (výplň, obrys, tloušťka), `card_grid`, `callout`, skupina aj. Text má `color`, `fontSize` (pt), `fontFamily`, `bold`, `italic`, `align`, `lineHeight`, `gradient`; boxy umí výplň i přechod.
- **Jeden vykreslovač `SlideCanvas`** pro editor, promítání, učitelský náhled i telefon žáka. Náhledy a PDF používají `SlideBody` nad stejnými daty, takže editor a promítání vypadají stejně.
- **Dnešní import:** první text je nadpis, ostatní pole se stanou odstavci nebo odrážkami. Pozadí, formát, tvary, obrázky, pozice a poznámky se zahazují.

Závěr: model už umí téměř vše, co Tyna chce. Hlavní práce je v importu, ne v modelu.

## 2. Co lze přenést
| PPTX prvek | Bez změny modelu? | Reálnost | Riziko |
|---|---|---|---|
| Pozadí: plná barva | Ano (`backgroundOverride.color`) | Vysoká | Nízké |
| Pozadí: obrázek | Ano (`backgroundOverride.image`) | Vysoká | Střední: uložení souboru, „contain" vs. „cover" |
| Pozadí: přechod 2 barvy | Ano | Vysoká | Nízké |
| Pozadí: přechod 3+ barev | Ne, model má jen od–do | Střední | Nízké: zatím aproximace první/poslední barvou, později rozšíření o `stops` |
| Pozice a velikost textových polí | Ano (`frame` + `zIndex`) | Vysoká | Střední: přepočet EMU → %, dědění z rozvržení a předlohy |
| Barva, velikost, tučnost, kurzíva, zarovnání | Ano, na úrovni bloku | Vysoká | Střední: barvy z motivu (`schemeClr`) je třeba dohledat v theme1.xml |
| Formát po jednotlivých slovech (smíšené barvy v odstavci) | Ne, styl platí pro celý blok | Nízká | Bere se převažující styl, případně omezené HTML |
| VELKÁ PÍSMENA (`cap="all"`) | Ne, chybí vlastnost | Vysoká | Nízké: převést text na velká písmena |
| Obdélník / zaoblená karta | Ano (`shape` + `frame`); zaoblení ověřit | Vysoká | Střední: poloměr rohů, obrys |
| Karta s textem (tvar + text v jednom) | Ano, jako 2 bloky: tvar pod textem | Vysoká | Nízké |
| Pilulka (plně zaoblený obdélník) | Ano, jako `shape` s maximálním zaoblením | Vysoká | Nízké |
| Obrázky | Ano (`image` + `frame`) | Vysoká | Střední: Storage, velikost, formáty EMF/WMF/TIFF |
| Ořez obrázku (`srcRect`) | Ne | Nízká | Bez ořezu, upozornit |
| Poznámky řečníka | Ano (`teacherNotes`, případně `device.instructions`) | Vysoká | Nízké |
| Skupiny tvarů | Ano, rozbalit na jednotlivé prvky | Střední | Střední: přepočet souřadnic skupiny |
| SmartArt, grafy, tabulky, video | Částečně | Nízká | SmartArt jen texty, graf obrázkem jen pokud je v souboru náhled |
| Animace a přechody mezi slidy | Ne | – | Ignorovat a upozornit |
| Nedostupná písma | Náhrada | – | Mapovat na blízké dostupné písmo (bezpatkové/patkové) |

## 3. Etapy
1. **Pozadí a styl textu.** Pozadí (barva, přechod, obrázek ze slidu, rozvržení nebo předlohy), barvy z motivu, velikost, tučnost, velká písmena, zarovnání. Každé textové pole dostane `frame` podle PPTX pozice. Slide nastaví `layout` na volné rozmístění, aby nic nezůstalo v toku. Motiv Bezli se vypne pomocí `backgroundOverride`.
2. **Tvary.** Obdélníky, zaoblené karty a pilulky jako `shape` s `frame` a `zIndex` podle pořadí v PPTX. Rozbalí se skupiny. Ověřit, nebo minimálně doplnit vlastnost zaoblení rohů.
3. **Obrázky.** Z `ppt/media` přes vztahy (`.rels`) se nahrají do `lesson-images` stávající cestou `presentations/<user>/…` (stejně jako u pozadí). Limit 10 MB na soubor a celkový limit na import. Povolené jsou jen PNG, JPG, GIF a WebP, kontrolované podle obsahu souboru, ne podle přípony. SVG ne (bezpečnost). EMF/WMF se přeskočí s upozorněním. Obrázek přes celý slide se uloží jako pozadí, ostatní jako bloky `image`. Velké fotky se před nahráním zmenší.
4. **Poznámky.** `notesSlideN.xml` se uloží do `teacherNotes`. `device.instructions` zůstane prázdné, aby se poznámky učitele neukázaly žákům.
5. **Volitelně:** přechod se 3+ barvami (`stops`), ořez obrázků, formát po slovech.

**Stejný vzhled všude:** všechno jde jen přes existující pole (`frame`, `backgroundOverride`, styl bloku), takže editor, promítání, telefon i PDF použijí stejný `SlideCanvas`/`SlideBody`. Nic se nevykresluje zvlášť pro import. Ověřit snímky obrazovky editoru a promítání na stejném slidu.

**Export:** PDF zachová vše, protože fotografuje vykreslený slide. Export do PPTX (`ExportPanel`/SlideSpec) dnes bere jen nadpis, text a poznámky, ne bloky, pozice ani pozadí. Věrný zpětný export je samostatný projekt; tento import ho nezhorší.

Na konci importu se ukáže souhrn: co se přeneslo a co ne (animace, SmartArt, nepodporované obrázky, nahrazená písma).

## 4. Rozsah a nejistoty
- Etapa 1: asi 1,5–2 dny. Etapa 2: asi 1 den. Etapa 3: asi 1,5 dne. Etapa 4: půl dne. Testy průběžně. Celkem zhruba 5 dní.
- **Nejistoty:**
  - dědění z rozvržení a předlohy;
  - barvy motivu včetně odstínů (`lumMod`);
  - automatické zmenšení textu (`normAutofit`), kdy se texty mohou přelévat;
  - rozdíly v řádkování písem;
  - „contain" u pozadí nechá okraje, pokud poměr stran PPTX není 16:9 (4:3 deky);
  - velikost importu a čas nahrávání;
  - kvóta úložiště.
- **Demo:** nahrávání obrázků platí jako běžné nahrávání učitele. Demo ochrany se nemění. Ověřit, že demo zápis do `lesson-images` je povolen stejně jako dnes u pozadí.
- **Databáze a oprávnění:** beze změn (jen JSON slidu a stávající úložiště).

## 5. Testovací deka (20 slidů) – co má import umět
- Přesně 20 slidů ve stejném pořadí.
- **Pozadí každého slidu:** fialový přechod 5D3D7F → 7A4BB0 → 4FB3BE, uložený v PPTX jako obrázek. Přenese se jako obrázek pozadí bez okrajů (deka 16:9) a nahraje se jen jednou, i když ho používají všechny slidy.
- **Titulní slide:** obrázek přes celý slide se stane pozadím a nadpis zůstane čitelně nad ním.
- **Nadpisy:** bílé, velkými písmeny (i když je velikost písmen nastavená jen formátem), tučné, ve správné velikosti a pozici.
- **Krémové zaoblené karty:** tvar se stejnou barvou, zaoblením a pozicí, text karty nad ním v původní barvě a velikosti.
- **Tyrkysové pilulky:** plně zaoblené, s textem uvnitř a správným pořadím vrstev.
- **Poznámky řečníka** jsou v poznámkách učitele, ne u žáka.
- **Editor, promítání, telefon a PDF** vypadají stejně a slide jde dál upravovat.
- **Kontroly:**
  - automatický test se vzorovým PPTX (počty prvků, barvy, rámy s tolerancí 1 %);
  - snímky obrazovky editoru a promítání u slidů 1, 2 a 20;
  - souhrn importu bez chyb.

Pro testy je potřeba Tynin skutečný soubor, nebo jeho zjednodušená kopie bez osobních údajů.
