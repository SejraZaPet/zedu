# Akademie jako obrázkový manuál + AI asistent k modulu

## Co uvidíte
- Každý modul učitelské Akademie bude vypadat jako stránka knihovny funkcí: nahoře **Cíl** a **Kde funkci najdete**, pak **snímky obrazovky s fialovými očíslovanými popisky**, pod každým snímkem očíslované kroky (1, 2, 3 … odpovídají číslům na snímku), dále **Propojení s jinou funkcí**, **Tip**, **Pozor** a **Výsledek** — s piktogramy (terč, žárovka, trojúhelník, řetěz).
- Kliknutím se snímek zvětší na celou obrazovku (už funguje).
- V každém modulu bude tlačítko **„Zeptat se k tomuto modulu"**: AI asistent odpovídá jen z textu daného modulu (a z propojených modulů), odpověď je označená „AI generováno" a chat začíná upozorněním, že jde o AI. Když odpověď v modulu není, řekne to a nabídne související modul.

## Postup
1. Znovu pořídím snímky 29 funkcí z demo učitele (zápisy blokované, jen smyšlená data) a opravím čísla zakrývající nápisy.
2. Snímky nahraji do veřejného úložiště obrázků (stejné jako u prezentací).
3. **Zápis do databáze (potřebuji Vaše schválení):** 29 modulů jako koncepty v kurzu „Bezli v každodenní výuce — pro učitele" (stávajících 7 modulů nahradí obsahově, nic jiného se nemaže); kurz zůstane nezveřejněný, dokud ho nezveřejníte.
4. Zobrazení: nový blok „Krok se snímkem" (snímek + očíslované popisky) a barevné rámečky Tip/Pozor/Propojení — jen vzhled, oprávnění beze změny.
5. AI asistent: využiji stávajícího tutora Bezlai s novým režimem „Akademie" (text modulu se posílá jako zdroj, nic se neukládá, demo limity platí).
6. Ověřím v prohlížeči na počítači i mobilu; nic nenasadím.

## Technické
- Blok `image` rozšířen o `props.callouts[]` (číslo + text); nové typy bloků `callout` (tip/warning/link) renderované v AcademyView, staré bloky beze změny.
- `ask-zedai-tutor`: volitelný `academyModuleId`; server načte modul sám (ne z klienta), model z `_shared/ai-models.ts`.
- Žádná změna schématu ani RLS.
