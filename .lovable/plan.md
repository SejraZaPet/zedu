# Myšlenkové mapy v Bezli – diagnostika a návrh

Pouze návrh. Nic se neimplementuje, DB se nemění, žádné e-maily ani nasazení.

## 1. Co dnes v aplikaci existuje

| Oblast | Co je | Myšlenková mapa? |
|---|---|---|
| Bloky učebnice (`textbook-config.ts`, `LessonBlockRenderer.tsx`, `admin/BlockEditor.tsx`) | 25 typů, mj. `hierarchy` (Hierarchie/Pyramida), `card_grid`, `shape`, `chart`, `two_column`, volné plátno `FreeFrameCanvas` | Ne. Nejblíž je `hierarchy` (jen pyramida/úrovně, bez větví) |
| Pracovní listy (`worksheet-spec.ts`, `worksheet-items/*`) | 30 typů, mj. `matching`, `sorting`, `flow_steps`, `image_label`, `two_boxes`, `table`, `blank_box` | Ne. `flow_steps` je lineární, `image_label` je „slepá mapa“ obrázku |
| Aktivity (`activity-meta.ts`, `components/activities/*`) | 15 typů: kvíz, kartičky, pexeso, přiřazování, třídění, řazení, doplňování, křížovka, popis obrázku, zeď, anketa… | Ne |
| Kreslení / diagramy | `NotebookCanvas` (sešit, kreslení perem), `FreeFrameCanvas`, `ShapeRenderer`, `ChartRenderer`; tahání přes `@dnd-kit` | Žádná knihovna uzlů/grafů (reactflow, xyflow, d3) není nainstalovaná |
| Metody výuky (`learning_methods` + `lesson_method_links`, `LessonMethodsPicker`) | V DB už existují metody **„Mind mapping“** (aktivizační) a „Brainstorming“ | Metoda ano, ale není k ní žádný nástroj |
| AI | `generate-activity-content`, `generate-practice`, `generate-full-worksheet` | Brainstorming řeší jen přes „zeď“ / otevřenou otázku |
| Hodnocení | `assignment_attempts.answers` + `score`, serverové bodování her v `_shared/game-scoring.ts`, přehled v `ActivityAnswerReview` / `TeacherResults` | – |
| Sešit, portfolio, projekce, plán hodiny | Sešit umí vložit pracovní list jako stránku (`InsertWorksheetButton`), projekce zobrazuje bloky a aktivity | – |

Závěr: myšlenková mapa zatím nikde není. Nejbližší jsou třídění, přiřazování a blok Hierarchie.

## 2. Navrhované řešení – jedna sdílená mapa

### Data (JSON, bez změny databáze)
```text
MindMap {
  version: 1
  layout: "radial" | "tree"        // automatické rozložení, žádné ruční souřadnice
  root: Node
}
Node {
  id, text, color?(token z Bezli palety), icon?, imageUrl?(lesson-images),
  children: Node[]
  blank?: true                     // u pracovního listu: žák doplňuje
  answer?: string, accept?: string[]  // jen u učitele, žákovi se neposílá
}
```
Strom místo volného grafu: jednodušší pro mobil, klávesnici, tisk i hodnocení. Křížové vazby až později.

### Jedna komponenta `MindMapView` s režimy
- **a) Zobrazení** (blok učebnice, materiál, slajd): rozbalování větví, přiblížení/posun prstem, „Zobrazit jako seznam“ (odrážky = textová alternativa).
- **b) Pracovní list – doplň mapu**: prázdné uzly; žák píše, nebo přetahuje pojmy z nabídky (stejný princip jako „Doplň z nabídky“). Automatické vyhodnocení (bez diakritiky/velikosti písmen, více přijatelných odpovědí) + ruční přebodování učitelem.
- **b2) Vytvoř vlastní mapu**: žák staví mapu podle zadání; hodnotí jen učitel (otevřená odpověď).
- **c) Aktivita třídy** (samostatný typ aktivity): nejdřív jen individuální; **společná mapa třídy v reálném čase doporučuji až později** (potřebuje novou tabulku a realtime).
- **d) AI návrh mapy** z textu lekce: rozšířit stávající `generate-activity-content` o typ `mind_map`, výsledek kontrolovat v `activity-ai-normalize.ts`, označit „AI generováno“. Náklady: jedno volání levného modelu na mapu, jako u ostatních aktivit.
- **e) Export**: vykreslení do SVG → PNG/PDF a tisk (SVG je ostré v tisku); vložení do sešitu přes stávající cestu pracovního listu, do portfolia jako obrázek.

Ovládání: uzly a tlačítka ≥ 44 px, na 390 px mapa uvnitř vlastního okna s posunem (stránka se vodorovně neposouvá), na úzkém displeji výchozí rozložení „strom shora dolů“. Klávesnice: šipky mezi uzly, Enter upravit, Tab přidat podřízený, Delete smazat. Barvy jen z Bezli design tokenů.

## 3. Kam to patří a napojení

| Místo | Soubor | Co |
|---|---|---|
| Blok učebnice | `textbook-config.ts`, `LessonBlockRenderer.tsx`, `admin/BlockEditor.tsx`, `block-conversions.ts`, `lesson-offline-export.ts` | nový blok `mind_map` ve skupině „Struktura a rozložení“ |
| Pracovní list | `worksheet-spec.ts`, `worksheet-items/MindMapItem.tsx`, `worksheet-print-renderer.ts`, `worksheet-pdf-export.ts`, `worksheet-attempt.ts` | typ `mind_map` (doplň / vytvoř) |
| Aktivita | `activity-meta.ts`, `components/activities/MindMapActivity.tsx`, `ActivityAnswerReview.tsx`, `activity-pdf-export.ts` | typ `mind_map` |
| Prezentace / projekce | `blocks-to-slides.ts` | blok se zobrazí jako slajd |
| Hodnocení | odpovědi do stávajícího `assignment_attempts.answers` (`{nodeId: text}`), body do `score`; v `TeacherResults` přehled správně/špatně po uzlech | bez DB změny |
| Metoda výuky | metoda „Mind mapping“ už v `learning_methods` je; při jejím výběru v plánu hodiny nabídnout „Vložit myšlenkovou mapu“ (`method-suggestion.ts`, `plan-to-slides.ts`) | bez DB změny |
| Živé hry | zatím ne – mapu nejde rozumně hrát na čas | – |

## 4. Rizika, testy, databáze

- **Výkon**: velké mapy na mobilu → limit (např. 60 uzlů, hloubka 4), vlastní SVG bez těžké knihovny.
- **Ukládání**: jen do stávajících JSON polí (bloky lekce, spec pracovního listu, obsah aktivity, `answers`). Autosave a undo přes stávající editory.
- **Oprávnění**: správné odpovědi se žákovi nesmí poslat – stejně jako u ostatních typů je odstranit z žákovské verze a vyhodnotit serverově/stávající cestou.
- **Tisk**: stabilní rozložení a stránkování A4.
- **Testy**: datový model a validace, rozložení (bez překryvů), vyhodnocení (diakritika, více odpovědí), převod na seznam, AI normalizace, odstranění odpovědí z žákovské verze, tisk; Playwright 390/1440 px.
- **Databáze**: etapy 1–3 ji nepotřebují. Jen společná mapa třídy (etapa 5) by potřebovala novou tabulku – návrh:
```sql
-- NÁVRH, NESPOUŠTĚT
create table public.mind_map_boards (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  data jsonb not null default '{}', updated_by uuid, updated_at timestamptz default now()
);
-- RLS dědí viditelnost assignments + demo_iso; rollback: drop table public.mind_map_boards;
```

## 5. Etapy

1. **Nejmenší užitečný krok**: sdílená `MindMapView` + blok učebnice „Myšlenková mapa“ (zobrazení, seznam, tisk) + pracovní list „Doplň mapu“ s automatickým hodnocením. Jen frontend.
2. Žák tvoří vlastní mapu (ruční hodnocení), export PNG/PDF, vložení do sešitu a portfolia.
3. Samostatná aktivita `mind_map` + AI návrh mapy z lekce + napojení na metodu „Mind mapping“ v plánu hodiny.
4. Slajdy/projekce, přetahování pojmů z nabídky.
5. (Později, s DB) společná mapa třídy v reálném čase.

Nové soubory: `src/lib/mind-map.ts` (model, validace, vyhodnocení, převod na seznam), `src/lib/mind-map-layout.ts`, `src/components/mind-map/MindMapView.tsx`, `MindMapEditor.tsx`, `worksheet-items/MindMapItem.tsx`, testy v `src/test/`.

## Na čem se rozhodnout
1. Schválit etapu 1 (blok učebnice + „Doplň mapu“ v pracovním listu)?
2. Jen strom (doporučuji), nebo i volné propojování uzlů?
3. Limit velikosti mapy (návrh 60 uzlů, hloubka 4)?
4. Společnou mapu třídy teď neřešit (doporučuji odložit)?
5. AI návrh mapy už v etapě 3, nebo dřív?
