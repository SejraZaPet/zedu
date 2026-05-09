# Server-side PDF generování (Edge Function)

## Volba enginu: pdfmake

Vybírám **pdfmake** (`npm:pdfmake@0.2`). Důvody:

- **Funguje v Deno/Supabase Edge Functions** bez nativních binárek (na rozdíl od Puppeteeru)
- **Zdarma**, žádný externí API klíč, žádné měsíční náklady
- Deklarativní DSL → čisté UTF-8 (čeština OK), vektorové fonty, tabulky, page breaks
- Spolehlivější než `@react-pdf/renderer` v Deno (méně závislostí)

**Trade-off:** Není to HTML→PDF. Stávající `worksheet-print-renderer.ts` zůstává pro `window.print()`; pro server-side napíšu nezávislé pdfmake šablony pro 3 typy dokumentů. Vzhled bude profesionální, ale ne pixel-identický s tiskem v prohlížeči — fonty Roboto (vestavěné v pdfmake), konzistentní ve všech prohlížečích a OS.

## Co přidám

### 1. Storage bucket `generated-pdfs`
Privátní bucket, podepsané URL s 1h expirací. Cesta: `{teacher_id}/{type}/{id}-{timestamp}.pdf`.

RLS: učitel čte/zapisuje jen své soubory (`auth.uid()::text = (storage.foldername(name))[1]`).

### 2. Edge Function `generate-pdf`
```
POST /functions/v1/generate-pdf
Body: { type: 'worksheet' | 'lesson_plan' | 'schedule', id: uuid, template?: string }
Resp: { url: string, path: string }
```

Flow:
1. Ověří JWT, načte `auth.uid()` (učitel)
2. Načte data z DB podle `type` + `id` (worksheets / lesson_plans+phases / class_schedule_slots)
3. Ověří RLS přístup (učitel musí být vlastník / class_teacher)
4. Sestaví pdfmake `docDefinition` přes příslušný builder (`builders/worksheet.ts` atd.)
5. Wrapne `pdfmake.createPdfKitDocument` → Uint8Array
6. Upload do Storage přes `service_role` client
7. Vrátí signed URL (3600s)

### 3. Edge Function `generate-pdf-batch`
```
POST /functions/v1/generate-pdf-batch
Body: { type, ids: uuid[] }
Resp: { url: string }  // ZIP s PDF soubory
```

Pro generování celé třídy. Použije `npm:jszip`, max 50 souborů na request, timeout-safe (CPU-bound, ne network).

### 4. Frontend integrace

**WorksheetEditor.tsx** — split button na export:
- "PDF (prohlížeč)" — stávající `window.print()` (ponechat beze změny)
- "PDF (server, kvalitní)" — volá `generate-pdf`, otevře signed URL v novém tabu

**TeacherLessonPlanEditor.tsx** — stejný dropdown pro lesson_plan.

**TeacherSubjectClass.tsx / Rozvrh** — tlačítko "Stáhnout PDF rozvrhu".

**Batch:** v `TeacherClassDetail.tsx` u bulk akcí přidat "Stáhnout PDF (vybrané worksheety)" → `generate-pdf-batch`.

Vše zabaleno do reusable hooku `usePdfExport(type, id)` s loading stavem a toastem "Generuji PDF…".

### 5. Audit log
Při každém generování `logAudit('pdf_generated', type, id, { batch: false })`.

## Nezahrnuto (vědomě)

- Pixel-perfect parity s `window.print()` — viz trade-off výše
- Externí HTML→PDF služba (Browserless/PDFShift) — vyžadovala by placený účet
- Cache vygenerovaných PDF — generuje se on-demand pokaždé (rychlé, jednoduché)
- Retence souborů ve Storage — zatím bez auto-cleanup; můžeme přidat pg_cron job později

## Soubory

Nové:
- `supabase/migrations/*` — bucket `generated-pdfs` + RLS
- `supabase/functions/generate-pdf/index.ts`
- `supabase/functions/generate-pdf/builders/worksheet.ts`
- `supabase/functions/generate-pdf/builders/lesson-plan.ts`
- `supabase/functions/generate-pdf/builders/schedule.ts`
- `supabase/functions/generate-pdf/_shared/pdfmake-setup.ts` (fonty, styly)
- `supabase/functions/generate-pdf-batch/index.ts`
- `src/hooks/usePdfExport.ts`
- `src/components/PdfExportButton.tsx` (split button reusable)

Upravené:
- `src/components/.../WorksheetEditor.tsx` — split button
- `src/pages/TeacherLessonPlanEditor.tsx` — split button
- `src/pages/TeacherClassDetail.tsx` — batch akce
- (rozvrh) komponenta dle aktuální lokace

## Otevřené otázky před spuštěním

1. **Šablona pro lesson_plan**: jen text fáze + slidy jako miniatury, nebo také obrázky slidů? (Obrázky slidů by vyžadovaly další render a výrazně by zpomalily — doporučuji jen text.)
2. **Rozvrh**: A4 na šířku s týdenní mřížkou, OK?
3. **Hlavička PDF**: má obsahovat logo ZEdu + jméno učitele/třídu/datum?

Pokud souhlasíš s pdfmake přístupem a odpovědi na 3 otázky výše jsou "default" (jen text / A4 landscape / ano logo+meta), spustím implementaci.
