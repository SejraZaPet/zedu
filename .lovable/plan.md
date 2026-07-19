## Krok 3 — návrh: "Změnit na…" pro existující blok

### UI umístění
Nová ikonka `ArrowRightLeft` (lucide) v hlavičce karty, mezi Eye/Duplikovat/Smazat, tooltip "Změnit na…". Klik otevře `DropdownMenu` (nebo `Popover`) se šířkou ~280 px, dvě sekce s uppercase nadpisy stejného stylu jako v Add-menu.

---

### Sekce 1 — "Formát" (okamžitá konverze, bez AI)

Zobrazí se jen typy ze **stejné kategorie** jako aktuální blok. Kategorie ale nesouhlasí s tím, které převody dávají obsahový smysl — proto mapování zúžíme na skutečně bezpečné dvojice:

**Text kategorie** (`heading | paragraph | bullet_list | quote | callout`)
Vnitřní "kanonický text" = `title` + `body`. Konverze:

| Z / do | heading | paragraph | bullet_list | quote | callout |
|---|---|---|---|---|---|
| heading | — | text = old.text | items = [old.text] | text = old.text | text = old.text, calloutType="note" |
| paragraph | text = strip(html), level=2 | — | items = split by `\n` nebo `<br>`/`<p>` | text = strip(html) | text = old.text |
| bullet_list | text = items.join(" · "), level=2 | text = items joined jako odstavce | — | text = items.join(" — ") | text = items joined |
| quote | text = old.text | text = old.text (+ autor v závorce) | items = [old.text, old.author?] | — | text = old.text |
| callout | text = old.text | text = old.text | items = split(old.text) | text = old.text | — |

Poznámka: `summary` má vlastní tvar (`title` + rich `text`) a v Kroku 2 patří do "Interaktivní a AI" menu; do konverzí ho nezařazovat, aby chování bylo předvídatelné.

**Structure kategorie** — zúžit na trojici, kde konverze dává smysl:
- **table → card_grid**: každý řádek = karta (`title` = 1. buňka, `text` = zbytek buněk spojený `" — "`), `columns` = min(headers.length, 3).
- **card_grid → table**: `headers = ["Název", "Popis"]`, každá karta = řádek `[title, text]`.
- **table → two_column**: jen když tabulka má právě 2 sloupce — `left` = 1. sloupec joined, `right` = 2. sloupec joined; jinak položku nezobrazovat.
- **two_column → table**: `headers = ["Sloupec 1", "Sloupec 2"]`, jeden řádek `[left, right]` (raw text bez HTML).
- **card_grid ↔ two_column**: neposkytovat (ztrátové a bez jasné intuice).
- `accordion`, `hierarchy`, `divider` z Formát-sekce vynechat (příliš specifické struktury).

**Media kategorie** — konverze mezi `image` / `image_text` / `gallery` / `youtube` nedává čistý smysl (URL vs. text vs. pole obrázků). Doporučuju **sekci "Formát" u media bloků skrýt** (menu ukáže jen "Vytvořit z obsahu" nebo bude prázdné → nezobrazovat trigger tlačítko, když není co nabídnout).

**Interactive kategorie** (`activity`, `lesson_link`) — Formát-sekci nezobrazovat.

Chování: klik = jedna `commit()` s přepsaným `type` a nově namapovanými `props`. Žádný loading, žádný toast (jen tichá záměna, undo/redo zůstává funkční přes existující history stack).

---

### Sekce 2 — "Vytvořit z obsahu" (AI, s indikátorem)

Zobrazí se **vždy** (nezávisle na kategorii), pokud z bloku dokážeme vytáhnout aspoň nějaký text (heading/paragraph/bullet_list/quote/callout/summary/table/card_grid/two_column/accordion). U čistě media / divider / lesson_link se sekce skryje.

Položky:
1. **"Aktivita / procvičování"** — ikona `Sparkles`, badge "AI".
2. **"Hierarchie / Pyramida"** — ikona `Sparkles`, badge "AI".

#### 2a) Aktivita → **znovu použít `generate-activity-spec`**
Edge funkce existuje a je přesně pro tenhle případ:
- `supabase/functions/generate-activity-spec/index.ts`
- Volání: `supabase.functions.invoke("generate-activity-spec", { body: { activityType, prompt, feedbackMode, deliveryMode } })`
- Vrací spec, který si už umí ActivityBlock renderovat.
- Používá se v `src/components/admin/ActivitySpecGenerator.tsx` — stejný smluvní tvar převezmeme.

Návrh chování:
- `activityType`: default `"mcq"` (rychlý kvíz z textu). Volitelně malá inline volba (mcq / fill_blank / matching) — v prvním kole ale doporučuju **jen `mcq`** a případný typ nechat na budoucí iteraci.
- `prompt` = extrahovaný plaintext bloku (viz "Extrakce textu" níže) + krátká instrukce "Vytvoř procvičení k tomuto textu".
- `feedbackMode: "immediate"`, `deliveryMode: "student_paced"`.
- Po úspěchu: nahradit blok novým `activity` blokem s `props.activityType = "mcq"` a odpovídajícími poli (`quiz: {...}`) — mapa výstup → props stejná jako v ActivitySpecGenerator.

#### 2b) Hierarchie/Pyramida — **nová edge funkce `generate-hierarchy`**
Žádná stávající funkce nevrací tvar `{ shape, direction, levels: [{ label, description }] }`, který `hierarchy` blok očekává. Nejčistší je nová malá edge funkce (~50 řádek) volající Lovable AI Gateway přes `ai-sdk-lovable-gateway` pattern:
- Vstup: `{ text: string }`.
- System prompt: rozděl text do 3–6 hierarchických úrovní (od nejobecnější po nejkonkrétnější / od základu po vrchol).
- Structured output přes `Output.object` (Zod schema **bez** `.min/.max`, limity v promptu + clamp v kódu).
- Výstup: `{ shape: "pyramid", direction: "top-to-bottom", levels: [{ label, description }] }`.
- Model: default `google/gemini-3-flash-preview`.

Alternativa: rozšířit stávající `generate-block-suggestions` o typ `hierarchy` — ale ta funkce vrací 3 varianty worksheet-bloků, ne textbook-block, takže bych šel novou funkcí.

#### Extrakce textu z bloku (client-side helper)
Jedna čistá funkce `blockToPlainText(block): string`:
- `heading`, `paragraph`, `quote`, `callout` → strip HTML z `text`.
- `bullet_list` → `items.map(strip).join("\n- ")`.
- `summary` → `title` + strip(`text`).
- `table` → řádky joined tabem, hlavičky jako první řádek.
- `card_grid` → karty jako `"title — text"` po řádcích.
- `two_column` → `left\n\nright` (strip).
- `accordion` → `"Q: title\nA: content"` per item.

#### Loading + error handling
- Loading stav **v samotné kartě**: přes header překryjeme obsah bloku (nebo `p-3` sekci) překryvem se `Loader2` spinnerem + textem "AI vytváří aktivitu…" / "AI vytváří hierarchii…".
- Stav držet v `SortableBlock` jako lokální `useState<'idle' | 'ai-activity' | 'ai-hierarchy'>`.
- Během běhu vypnout ostatní akce v hlavičce (disabled).
- Úspěch: `onUpdate` nezmění `type`, potřebujeme cestu i pro **změnu typu**. Rozšířit props `SortableBlock` o nové callbacky:
  - `onReplace(id, newType, newProps)` — bezpečně přepíše `type` + `props` v jedné `commit()`.
- Chyba (network / 429 / 402 / parse fail): `toast.error(...)` s konkrétní zprávou (rate limit vs. credits vs. generic), blok zůstane beze změny.

---

### Dotčené soubory (jen pro orientaci, v implementační fázi)
- `src/components/admin/BlockEditor.tsx` — nová ikona v hlavičce, popover s dvěma sekcemi, `onReplace` callback do `commit()`, lokální loading state per-blok.
- `src/lib/textbook-config.ts` **nebo** nový `src/lib/block-conversions.ts` — mapy `FORMAT_TARGETS` a čisté funkce `convertBlock(block, targetType)` + `blockToPlainText(block)`.
- `supabase/functions/generate-hierarchy/index.ts` — nová edge funkce (Lovable AI, structured output přes AI SDK).
- Znovupoužít: `supabase/functions/generate-activity-spec/index.ts` (beze změn) a mapování výstupu podle `ActivitySpecGenerator.tsx`.

---

### Otevřené otázky před implementací
1. **Formát-sekce u media / interactive** — potvrzuješ, že se u nich celé "Formát" schová (a případně i celý trigger, když ani AI sekce nemá co nabídnout)? Nebo chceš ikonu vždy viditelnou a v menu jen "Nic k dispozici"?
2. **Activity default typ** — jet natvrdo `mcq` v prvním kole, nebo hned v menu rozbalit tři podpoložky ("Kvíz", "Doplňovačka", "Přiřazování")?
3. **`summary` a `hierarchy`** ve Formát-sekci — potvrzuju, že je z konverzí vypouštím (viz výše), OK?
