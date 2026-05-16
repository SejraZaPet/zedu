# Vizuální editor prezentace (PowerPoint-like)

Přepracuji `PresentationEditorDialog` na vizuální editor: učitel klikne na text v náhledu a edituje, vybere layout, přidává/přesouvá bloky. Vše se promítá 1:1 do `ProjectorSlideView`.

## 1. Datový model
Rozšířit slide o:
```ts
slide.layout?: "full" | "two-cols" | "three-cols" | "img-left" | "img-right" | "title-only"
slide.heroImage?: string  // URL pro layouty img-*
slide.projector.fontScale?: number  // už existuje
```
Default `layout = "full"`. Žádná DB migrace — slides jsou JSON v `live_sessions.slides`.

## 2. Nová komponenta `SlideCanvas`
Sdílená vizuální vrstva používaná v:
- `PresentationEditorDialog` (editovatelná, `editable=true`)
- `ProjectorSlideView` (read-only projektor)
- `ProjectorPreview` (read-only mini náhled — nahrazen `SlideCanvas`)

Props: `slide, editable, onUpdateHeadline, onUpdateBlock, onMoveBlock, onDeleteBlock, fontScale, darkMode`.

Vykresluje podle `slide.layout`:
- **full** — nadpis nahoře, bloky pod sebou
- **two-cols / three-cols** — nadpis, pak grid, bloky rozděleny napůl/po třetinách; v three-cols každý blok v kartě (`bg-card rounded-xl p-4 shadow-sm border`)
- **img-left / img-right** — 2-sloupcový grid s obrázkem a textem
- **title-only** — velký centrovaný nadpis

## 3. Inline editace
Pro nadpis a každý textový blok (`paragraph`, `list` položky, buňky tabulky):
```tsx
<element
  contentEditable={editable}
  suppressContentEditableWarning
  onBlur={(e) => onUpdate(e.currentTarget.innerText)}
  className="cursor-text rounded px-1 hover:bg-white/10 focus:ring-2 focus:ring-primary outline-none"
/>
```
Stav editace `editingId` lokálně v `SlideCanvas`. Po blur se commitne do `slide.blocks` přes `onUpdateBlock(blockId, patch)`.

## 4. Toolbar nad/pod náhledem
- **Select "Rozvržení slidu"** s 6 layouty
- **Tlačítka "+ Text", "+ Odrážky", "+ Obrázek", "+ Tabulka"** — appendují blok přes `BlockEditor` API (`paragraph | list | image | table`)
- **+ Obrázek** otevře existující `MediaPickerDialog` pro výběr/upload

## 5. Hover ovládání bloků
V edit módu při hoveru na blok floating toolbar v rohu: `↑ ↓ 🗑` — volá `onMoveBlock(id, "up"|"down")` a `onDeleteBlock(id)`. Implementace přes group/group-hover Tailwind.

## 6. Miniatury slidů (thumbnail strip)
Nahoře v dialogu horizontální pás miniatur (`w-32 h-18`, aspect-video). Každá miniatura renderuje `SlideCanvas` v read-only s `transform: scale(...)` (stage 1600×900 zmenšené do thumbnailu). Aktivní slide `ring-2 ring-primary`. Klik → `setEditingSlideIndex(i)`.

Drag & drop přes `@dnd-kit/core` + `@dnd-kit/sortable` (už v projektu) pro reorder pendingSlides.

## 7. Pokročilý textový editor
Stávající `BlockEditor` a textarea pro `projector.body` přesunout do `<Collapsible>` "Pokročilý editor" pod náhledem.

## 8. Projektor parita
`ProjectorSlideView` použije `SlideCanvas` s `editable=false`, aby projektor i editor vykreslovaly identický layout (včetně grid sloupců).

## Soubory
- **Nový**: `src/components/admin/SlideCanvas.tsx` — sdílená vizuální vrstva s inline editací a layouty
- **Nový**: `src/components/admin/SlideThumbnailStrip.tsx` — DnD pás miniatur
- **Upraveno**: `src/components/admin/PresentationEditorDialog.tsx` — nahradit `ProjectorPreview` za `SlideCanvas`, přidat toolbar (layout select + add blocks), thumbnail strip nahoře, advanced editor do Collapsible
- **Upraveno**: `src/components/live/ProjectorSlideView.tsx` — použít `SlideCanvas` pro stejné vykreslení layoutů

## Mimo rozsah
- Drag & drop bloků uvnitř slidu (jen ↑/↓ tlačítka)
- WYSIWYG formátování (bold/italic) v contentEditable
- Editace tabulkových buněk inline (zatím přes Pokročilý editor)
- Speciální zarovnání obrázků v rámci bloku
