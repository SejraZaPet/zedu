## Diagnostický nález (bez úprav)

### 1. Soubor `src/lib/worksheet-pdf-export.ts`
Existuje (3854 B, mtime 2026-07-18 10:26). Dnes nebyl přejmenován, přesunut ani smazán.

### 2. Kdo modul importuje
Jediný odkaz v celém projektu:
- `src/pages/WorksheetEditor.tsx:163` — **statický** `import { downloadWorksheetPdf, buildWorksheetPdfBlobUrl } from "@/lib/worksheet-pdf-export"`.

Žádný `import(...)` dynamický import na tento modul v `src/` neexistuje. `WorksheetEditor` je v `src/App.tsx:58` také naimportovaný staticky (žádné `React.lazy`).

### 3. Souvislost s dnešními PDF úpravami
**Žádná přímá.** Dnes upravené soubory (`pdf-page-renderer.ts`, `ImportTextbookFileDialog.tsx`, `process-file-content`, `LessonBlockRenderer.tsx`, `textbook-config.ts`, `BlockEditor.tsx`, `HierarchyBlock.tsx`, `vite.config.ts`) na `worksheet-pdf-export` neodkazují a soubor sám nebyl dotčen.

### Interpretace chybové hlášky
URL v chybě: `https://lovable.dev/src/lib/worksheet-pdf-export.ts`.
- Origin `lovable.dev` není produkce (`zedu.lovable.app` / `zedu.cz`) ani preview subdoména (`id-preview--…lovable.app`) — je to hostname editorového sandboxu.
- Cesta `/src/lib/…​.ts` je Vite **dev-mode** URL (produkce servíruje hashované `.js` z `/assets/`).
- "Failed to fetch **dynamically** imported module" pochází z Vite dev serveru — v dev módu Vite načítá i staticky importované moduly jako samostatné ESM requesty a při selhání je hlásí jako dynamické.

### Nejpravděpodobnější příčiny (seřazeno)
a) **Stará karta / iframe editoru na `lovable.dev`** ze zaniklé sandbox session. Bundler pryč → 404 → HMR/retry cyklus vysvětluje desítky/stovky opakování. Řešení: zavřít/refreshnout kartu.
b) **Wedged Vite dev-server** v aktivním sandboxu po dnešní změně `vite.config.ts` (`optimizeDeps.exclude: ["pdfjs-dist"]`). Řešení: restart dev serveru.
c) Stale Service Worker (`zedu-v2`) — nepravděpodobné, protože sw.js přes `/src/**/*.ts` nechodí a origin je stejně jiný než produkce.

### Doporučený další krok (bez editace)
Zjistit od uživatelky přesný origin karty, kde chybu vidí:
- `lovable.dev/...` → zavřít starou editorovou kartu.
- `id-preview--…lovable.app` → restart Vite dev serveru v sandboxu.
- `zedu.cz` / `zedu.lovable.app` → nutno prošetřit dále (odregistrovat SW, hard reload, ověřit produkční bundle).

Až uživatelka potvrdí, který origin to je, navrhnu konkrétní opravu.
