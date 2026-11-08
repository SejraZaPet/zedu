# Pracovní list: „Postup podle metody“ a „Příklady z praxe“ (AI)

Pouze návrh. Nic se neimplementuje bez výslovného schválení. Práce na „Ke kontrole“ zůstává nedotčena.

## 1. Co jsem zjistila (čtením)

**Návrh podle metody** (`TeacherSuggestByMethod.tsx`, dlaždice učitele)
- Učitel vybere metody z katalogu `learning_methods` (název, popis, `steps_json`, `template_phases_json`, příklad, tipy), téma, předmět, volitelně „zaměření myšlení“.
- Edge funkce `suggest-lesson-from-methods` (Gemini 2.5 Flash, demo limit přes `demoAiGuard`) vrací: název, shrnutí, **6 pevných fází** (úvod, motivace, hlavní, procvičení, reflexe, závěr – čas, popis, pomůcky, aktivity), instrukce pro učitele, poznámky k metodám a volitelně **modelovou situaci z praxe** (scenario + task).
- Výstup lze uložit jako plán hodiny (`lesson_plans`, `ai_generated`), vložit do lekce, nebo založit **nový** pracovní list – ten dostane jen blok „Případová studie“ (`instruction_box`) a text fází jako podklad pro generátor. Do **existujícího** listu se návrh vložit nedá a fáze metody se v listu jako struktura neobjeví.

**Editor pracovního listu** (`WorksheetEditor.tsx`)
- Obsah je JSON `worksheets.spec` (WorksheetSpec), položky mají `type` z ~28 typů; nové typy se přidávají jako `mind_map`: typ ve `worksheet-spec.ts`, výchozí hodnoty a popisek ve `worksheet-defaults.ts`, editor polí, komponenta v `worksheet-items/index.ts`, větev v `worksheet-print-renderer.ts` (tisk/PDF) a offline exportu.
- Už existuje `flow_steps` (diagram kroků, jen zobrazení) a `open_answer` (ruční hodnocení).
- AI úprava jednoho bloku: `worksheet-block-refine` (s demo limitem). Štítek AI: `ai_generated` / `ai_modified_at` na listu + `AiContentBadge`.

## 2. Návrh – nový blok „Postup podle metody“

Nový typ položky `method_steps` uložený v existujícím JSON listu (bez změny DB):

```text
method_steps
 ├─ metoda (id + název, jen pro zobrazení)
 ├─ úvodní instrukce pro žáka
 └─ fáze[] (max 8): název fáze, zadání pro žáka,
     způsob odpovědi: žádná / řádky / pole, body (výchozí 0)
```

- **Hodnocení:** výchozí nehodnocená část (0 bodů). Učitel může u fáze nastavit body – pak se hodnotí ručně jako otevřená odpověď (stejně jako `open_answer`, objeví se i v „Ke kontrole“). Automatické hodnocení se nezavádí.
- **Vložení v editoru:** „Přidat část → Postup podle metody“ → dialog:
  1. Vybrat metodu z katalogu → fáze se předvyplní z `steps_json`/`template_phases_json` (bez AI).
  2. Nebo „Vložit z posledního Návrhu podle metody“ – jedním klikem převezme fáze a aktivity z uloženého návrhu (sessionStorage / zvolený plán hodiny), bez nového volání AI.
  3. Vše jde před vložením upravit, smazat, přeřadit.
- **Žák (přehrávač):** fáze jako očíslované karty pod sebou, u každé zadání a pole pro odpověď; autosave jako ostatní položky; mobil 390 px, cíle ≥44 px.
- **Tisk/PDF:** fáze jako číslované rámečky s linkami pro odpověď; v klíči učitele nic navíc (správné odpovědi neexistují).

## 3. Návrh – „Příklady z praxe“ (AI jen navrhuje)

Nový typ položky `practice_examples` (seznam příkladů: nadpis, situace, otázka pro žáka, volitelné body/odpověď) – plně ruční varianta funguje vždy, i bez AI.

Tlačítko „Navrhnout příklady z praxe“ v editoru bloku:
- Zadání: obor (gastronomie / hotelnictví / ekonomika / jiný), téma (předvyplněné z názvu listu/lekce), ročník, počet 1–5.
- **Do AI jde jen** téma, obor, ročník, počet – žádná jména, odpovědi ani údaje žáků.
- Výsledek se zobrazí jako **návrhy v dialogu**; každý lze upravit, přijmout nebo zahodit. Do listu se uloží až po „Vložit vybrané“. Neuložený návrh žák nikdy neuvidí (žák vidí jen publikovaný list).
- Přijaté příklady i list se označí neutrálně „vytvořeno s pomocí AI“ (`ai_generated`/`ai_modified_at` + `AiContentBadge`), v souladu s pravidly EU AI Act.
- **Technicky:** doporučuji rozšířit stávající `worksheet-block-refine` o novou akci „practice_examples“ (stejný model Gemini 2.5 Flash, stejný `demoAiGuard` a počítadlo, žádná nová tabulka). Alternativa: nová malá edge funkce – víc práce, stejný efekt.
- **Náklady/limity:** jedno volání na kliknutí (řádově jednotky haléřů); demo účty mají stávající limit, běžní učitelé limit nemají. Při chybě / 429 / vyčerpání kreditů: srozumitelná hláška, nic se nevloží, ruční zadání zůstává dostupné.
- Prompt: vyžadovat realistické, věku přiměřené, nezávadné situace bez reálných osob a značek; učitel obsah vždy kontroluje (AI se může mýlit ve faktech, cenách, legislativě).

## 4. Etapy (od nejmenší)

1. **Postup podle metody – ručně** (jen frontend): nový typ, editor, přehrávač, tisk/PDF, předvyplnění z katalogu metod. Bez AI, bez DB.
2. **Vložení z Návrhu podle metody** jedním klikem (jen frontend).
3. **Příklady z praxe – ručně** (jen frontend).
4. **AI návrhy příkladů** – úprava edge funkce `worksheet-block-refine` (vyžaduje schválení a nasazení funkce).

Dopady: stávající listy beze změny (nové typy jen přibudou; staré verze aplikace neznámý typ nevykreslí – nasadit frontend celý). Bez DB, RLS, e-mailů. Rodičovský přehled beze změny.

**Testy:** výchozí hodnoty a limity fází; převod metody/návrhu na fáze; nehodnocený blok = 0 bodů a nepočítá se do maxima; bodovaná fáze → ruční hodnocení; tisk obsahuje všechny fáze; student verze bez klíče; AI odpověď se normalizuje a nic se neuloží bez potvrzení; prompt neobsahuje žákovská data.

**Rizika:** nesprávný AI obsah (zmírnění: povinná kontrola učitelem, štítek); nezletilí (žádná data žáků v promptu, nevhodný obsah filtrovat promptem + kontrola); zátěž hodnocení u bodovaných fází (výchozí 0 bodů).

## Otevřené otázky

1. Má být „Postup podle metody“ ve výchozím stavu nehodnocený (doporučuji), nebo bodovaný?
2. Fáze předvyplnit podle kroků metody z katalogu, nebo podle 6 fází hodiny z Návrhu podle metody? (Doporučuji obojí: katalog jako výchozí, návrh jako volba.)
3. Mají příklady z praxe obsahovat i úkol/otázku pro žáka, nebo jen popis situace?
4. Začít etapou 1 (doporučuji), nebo 1+3 najednou? Etapa 4 až po vašem schválení úpravy AI funkce.
