# "Změnit na…" – návrh mapování a AI reuse

Než začnu implementovat, tady je konkrétní návrh na dvě věci, které ses ptal ověřit: (1) přesné mapování mezi typy bloků v sekci "Formát" a (2) jestli lze znovupoužít existující AI edge funkce pro sekci "Vytvořit z obsahu".

## 1) Sekce "Formát" — přesné mapování (bez AI)

Kategorie odpovídají tomu, jak jsou bloky rozdělené v redesignu editoru (Text / Média / Struktura / Interaktivní).

### Text ↔ Text (plně obousměrné, bezpečné)
Zúčastněné typy: `heading`, `paragraph`, `bullet_list`, `quote`, `callout`.

| Zdroj → cíl | Chování |
|---|---|
| `heading` → `paragraph` / `quote` / `callout` | zkopíruje se `text` (HTML se zploští na plaintext); u `quote` `author=""`, u `callout` `calloutType="note"` |
| `heading` → `bullet_list` | 1 položka = celý nadpis |
| `paragraph` → `heading` | `level=2`, text z odstavce (bez HTML) |
| `paragraph` → `bullet_list` | rozdělí obsah podle řádků / odrážek (`\n`, `•`, `-`, `–`); prázdné se zahodí |
| `paragraph` → `quote` / `callout` | text 1:1, u `quote` `author=""`, u `callout` `type="note"` |
| `bullet_list` → `paragraph` | položky spojeny prázdným řádkem |
| `bullet_list` → `heading` | položky spojené `" · "` (max 2. úroveň) |
| `bullet_list` → `quote` / `callout` | položky spojené `" — "` resp. `\n` |
| `quote` → `paragraph` / `heading` / `bullet_list` / `callout` | přenese `text`; autor se u `paragraph` zapíše v závorce, u `bullet_list` jako druhá položka, jinak se zahodí |
| `callout` → `paragraph` / `heading` / `quote` / `bullet_list` | přenese `text` (typ callout se ignoruje); u `bullet_list` rozděl podle řádků |

Poznámka: nezachovávají se odkazy uvnitř RichTextu (u vsupu HTML se strippuje na plaintext, aby cíle nedostávaly `<h2>` uvnitř `<li>` apod.). U `paragraph`/`heading` cíl přijímá HTML — ok, protože prostý text je validní HTML.

### Média ↔ Média — VYNECHÁVÁM
`image`, `image_text`, `gallery`, `youtube` mají zásadně různé povinné vstupy (single URL vs. gallery pole vs. `youtube.url`), takže "reformátování stejného obsahu" reálně neexistuje — buď duplikuje informaci, nebo mažeme text. Nechal bych sekci "Formát" u mediálních bloků prázdnou (tzn. tlačítko "Změnit na…" se u nich nezobrazí, pokud AI sekce taky nebude aplikovatelná).

### Struktura ↔ Struktura (omezená, s pojistkou)
Zúčastněné typy: `table`, `card_grid`, `two_column`. (`accordion`, `hierarchy`, `divider` mají příliš specifický obsah — vynechávám.)

| Zdroj → cíl | Chování |
|---|---|
| `table` → `card_grid` | každý řádek = 1 karta: `title = row[0]`, `text = row[1..].join(" — ")`; `columns = min(max(headers.length, 2), 3)` |
| `table` → `two_column` | POVOLENO **pouze** když má tabulka přesně 2 sloupce; `left = řádky[0].join("\n\n")`, `right = řádky[1].join("\n\n")`. Jinak volba není v menu. |
| `card_grid` → `table` | `headers = ["Název","Popis"]`; `rows = cards.map(c => [c.title, c.text])` |
| `two_column` → `table` | `headers = ["Sloupec 1","Sloupec 2"]`; 1 řádek s `[left, right]` |

`accordion`/`hierarchy` nejsou v mapování — vestavěná struktura (položka+obsah, resp. úrovně) se ztratí jakkoli by se namapovaly.

### Chování UI
- Tlačítko "Změnit na…" (ikona `ArrowRightLeft`) se u bloku **skryje**, pokud pro daný typ neexistuje žádná položka ve Formátu ani není splněná podmínka pro AI sekci (viz níže).
- Formát přepíše `block.type` a `block.props` na místě (stejné `id`, stejný `visible`), commit jde přes stávající undo/redo historii → dá se snadno vrátit `Ctrl+Z`.
- Bez potvrzovacího dialogu (nechceme zdržovat) — je to okamžitá, undoable operace.

## 2) Sekce "Vytvořit z obsahu" — AI reuse

Existující edge funkce jsem prošel; relevantní kandidáti:

- `generate-activity-spec` — vrací **ActivitySpec** (pole `type: mcq/matching/hotspot/interactive_video`, plus `worksheetMapping`, `accessibility`, `projectorPolicy`, atd.). **Není 1:1 kompatibilní** s tvarem, který renderuje `ActivityBlock` v editoru (ten čeká `activityType + quiz/flashcards/matching/…` s odlišnými poli, např. `quiz.answers[].correct` místo `choices/correctIndex`). Vyžadovala by adaptér, ale ztratí se většina metadat ActivitySpec.
- `generate-mcq` — jednoduchá funkce generující MCQ otázky. Bližší k tomu, co `ActivityBlock.quiz` používá (`question`, `answers[{text, correct}]`, `explanation`).
- `generate-block-suggestions` — generuje návrhy dalších bloků do lekce, ne převod stávajícího obsahu.
- `generate-hierarchy` **neexistuje** — pro AI variantu "Hierarchie/Pyramida" ji potřebujeme vytvořit novou.

**Doporučení pro implementaci** (budu čekat na tvoje potvrzení):

1. **"Aktivita/procvičování"** → znovupoužít `generate-mcq` (odpovídá přesně tvaru `activity` bloku s `activityType="quiz"`). Vstup = plaintext extrahovaný z bloku (`text`, `items`, popisky karet, …). Výstup napojíme na `props.quiz`. Pokud později budeme chtít další typy (flashcards, matching), přidá se druhá položka v menu; `generate-activity-spec` bych **nezapojoval**, ledaže chceš, aby výsledek nesl kompletní ActivitySpec metadata — pak bude potřeba psát mapper i změnu `ActivityBlock`.
   - Alternativa: pokud `generate-mcq` nevyhovuje (např. neumí česky nebo očekává jiné vstupy), přidám novou lightweight edge funkci `generate-activity-from-text` cílenou přesně na tvar `ActivityBlock`.
2. **"Hierarchie/Pyramida"** → nová edge funkce `generate-hierarchy` (Gemini 3 Flash, structured tool call: `direction`, `levels: [{label, description?}]`, 3–6 úrovní). Vstup = plaintext bloku. Výstup napojíme na tvar `hierarchy` bloku (`shape: "pyramid"`, `direction`, `levels[{id,label,description}]`).

**UI během AI volání:**
- V hlavičce bloku se vedle ikony "Změnit na…" objeví spinner + `Loader2`; tlačítko se disabluje. Zbytek editoru dál použitelný.
- Chyba (429/402/500) → `toast.error` s konkrétní hláškou ("Nedostatek kreditů", "Příliš mnoho požadavků, zkuste to za chvíli", jinak generická). Blok se nemění.
- Úspěch → commit do historie (undoable), toast.success s krátkou zprávou ("Blok převeden na aktivitu. Zkontrolujte prosím obsah.").

**Kdy je AI sekce dostupná:** pouze pokud extrahovaný plaintext bloku má > 8 znaků (jinak by AI dostávala prázdný vstup). Bloky typu `image`, `divider`, `lesson_link`, `youtube` bez popisku tak AI sekci nezobrazí.

## Otevřené otázky — potvrď, jak dál

1. **Media kategorie**: OK ji ve "Formátu" **vynechat** (button "Změnit na…" bude u mediálních bloků skrytý, ledaže má AI sekce co nabídnout)? Nebo chceš minimální mapování (např. `image` → `gallery` = 1 obrázek, `image_text` → `image` = zahodit text)?
2. **Aktivita – kterou AI cestu**:
   - (a) **`generate-mcq`** (rychlé, ale jen kvíz), NEBO
   - (b) nová **`generate-activity-from-text`** (jen kvíz, ale explicitně cílená na `ActivityBlock`), NEBO
   - (c) **`generate-activity-spec` + adaptér** (víc typů, ale ztratí ActivitySpec metadata a je to víc kódu)?
3. **Hierarchie**: OK vytvořit novou edge funkci `generate-hierarchy` (Gemini 3 Flash, structured tool call, 3–6 úrovní)?
4. **Undo pro AI výsledek**: má být převod přes AI zapsán do historie (Ctrl+Z vrátí zpět na původní blok)? Doporučuju ano — je to konzistentní s Formátem a chrání před špatnými AI výstupy.

Po potvrzení implementuji: `src/lib/block-conversions.ts` (mappery), `ReplaceMenu` v `BlockEditor.tsx`, `aiReplaceBlock` handler, případně novou `supabase/functions/generate-hierarchy/`.
