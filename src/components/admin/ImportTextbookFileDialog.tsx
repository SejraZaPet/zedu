import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";
import { Loader2, Upload, FileText, Trash2, Sparkles, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// PDF text extraction uses pdfjs-dist via extractPdfText (dynamically imported
// where used to keep it out of the initial bundle). Replaces an earlier
// regex-based Tj/TJ parser that failed on compressed streams / CID fonts.

interface TopicOption {
  id: string;
  title: string;
  gradeLabel?: string;
}

interface DraftLesson {
  id: string;
  title: string;
  blocks: Block[];
  include: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topics: TopicOption[];
  defaultTopicId?: string;
  onImported: () => void;
}

const ACCEPT = ".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_BYTES = 25 * 1024 * 1024;

const readFileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === "string" ? reader.result : "";
    const [, base64 = ""] = result.split(",");
    if (!base64) {
      reject(new Error("Soubor se nepodařilo převést do base64."));
      return;
    }
    resolve(base64);
  };
  reader.onerror = () => reject(new Error("Nelze načíst soubor."));
  reader.readAsDataURL(file);
});

const ImportTextbookFileDialog = ({
  open, onOpenChange, topics, defaultTopicId, onImported,
}: Props) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [drafts, setDrafts] = useState<DraftLesson[]>([]);
  const [topicId, setTopicId] = useState<string>(defaultTopicId ?? "");
  const [saving, setSaving] = useState(false);
  const [singleLesson, setSingleLesson] = useState(true);
  const [progress, setProgress] = useState<string>("");
  const [manualText, setManualText] = useState<string>("");
  const [usedVisionFallback, setUsedVisionFallback] = useState(false);

  const reset = () => {
    setFile(null);
    setDrafts([]);
    setProcessing(false);
    setSaving(false);
    setProgress("");
    setManualText("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleProcess = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ title: "Soubor je příliš velký", description: "Maximálně 25 MB.", variant: "destructive" });
      return;
    }

    setProcessing(true);
    setProgress("Načítám soubor...");

    try {
      const base64 = await readFileAsBase64(file);
      const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";

      // STEP 1: Extract text FIRST so we know per-page quality and can decide
      // which pages need a full-page render fallback (scanned/image-only pages).
      let extractedText = "";
      let textPages: { pageNumber: number; charCount: number }[] = [];
      if (manualText.trim().length >= 20) {
        extractedText = manualText.trim();
      } else if (isPdf) {
        try {
          setProgress("Extrahuji text z PDF...");
          const { extractPdfText } = await import("@/lib/pdf-page-renderer");
          const result = await extractPdfText(file);
          extractedText = result.text;
          textPages = result.pages.map((p) => ({ pageNumber: p.pageNumber, charCount: p.charCount }));
        } catch (err) {
          console.warn("PDF text extraction failed:", err);
        }

        // Raw-bytes fallback: if pdfjs returned NOTHING across the whole
        // document (typical for PPT-exported PDFs with missing ToUnicode maps),
        // scan the PDF byte stream for Tj/TJ literals. Not layout-aware, but
        // often recovers usable text where pdfjs refuses.
        const totalChars = textPages.reduce((s, p) => s + p.charCount, 0);
        if (totalChars === 0) {
          try {
            setProgress("Zkouším náhradní extrakci textu...");
            const { extractPdfTextRaw } = await import("@/lib/pdf-page-renderer");
            const rawResult = await extractPdfTextRaw(file);
            if (rawResult.text.length > 0) {
              extractedText = rawResult.text;
              textPages = rawResult.pages.map((p) => ({ pageNumber: p.pageNumber, charCount: p.charCount }));
            }
          } catch (err) {
            console.warn("Raw PDF text extraction failed:", err);
          }
        }

        // If BOTH extraction paths produced nothing, fall through — the AI
        // vision path below will receive `fileBase64` and read the PDF as an
        // image. No hard stop / toast here.
      }


      // STEP 2: Render + upload PDF page images — but ONLY for pages where
      // text extraction was insufficient (charCount < 30). For pages where
      // text extraction succeeded, the text is authoritative and a duplicate
      // full-page render would only clutter the lesson.
      const TEXT_QUALITY_THRESHOLD = 30;
      const pagesNeedingRender = new Set<number>();
      if (isPdf) {
        if (textPages.length > 0) {
          for (const p of textPages) {
            if (p.charCount < TEXT_QUALITY_THRESHOLD) pagesNeedingRender.add(p.pageNumber);
          }
        }
      }
      // pageImageUrls is 0-indexed; empty string means "do not insert".
      const pageImageUrls: string[] = [];
      if (isPdf && pagesNeedingRender.size > 0) {
        try {
          setProgress("Renderuji stránky PDF (fallback pro naskenované stránky)...");
          const { renderPdfPagesToImages } = await import("@/lib/pdf-page-renderer");
          const pageImages = await renderPdfPagesToImages(file);
          if (pageImages.length > 0) {
            setProgress(`Nahrávám ${pagesNeedingRender.size} fallback stránek...`);
            const folder = `pdf-import/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            for (let i = 0; i < pageImages.length; i++) {
              const pageNumber = i + 1;
              const willInsert = pagesNeedingRender.has(pageNumber);
              if (!willInsert) {
                pageImageUrls.push("");
                continue;
              }
              const dataUrl = pageImages[i];
              const blob = await (await fetch(dataUrl)).blob();
              const path = `${folder}/page-${pageNumber}.jpg`;
              const { error: upErr } = await supabase.storage
                .from("lesson-images")
                .upload(path, blob, { contentType: "image/jpeg", upsert: true });
              if (upErr) {
                console.warn("Upload stránky selhal:", upErr);
                pageImageUrls.push("");
                continue;
              }
              const { data: urlData } = supabase.storage.from("lesson-images").getPublicUrl(path);
              pageImageUrls.push(urlData.publicUrl);
            }
          }
        } catch (err) {
          console.warn("Nelze renderovat PDF stránky jako obrázky:", err);
        }
      }

      // STEP 3: Extract + upload EMBEDDED raster images from PDF.
      const pdfEmbeddedImagesByPage = new Map<number, string[]>();
      if (isPdf) {
        try {
          setProgress("Hledám vložené obrázky v PDF...");
          const { extractPdfEmbeddedImages } = await import("@/lib/pdf-page-renderer");
          const items = await extractPdfEmbeddedImages(file);
          if (items.length > 0) {
            setProgress(`Nahrávám ${items.length} vložených obrázků...`);
            const folder = `pdf-embedded/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            for (let i = 0; i < items.length; i++) {
              const { pageNumber, blob } = items[i];
              const path = `${folder}/page-${pageNumber}-image-${i + 1}.jpg`;
              const { error: upErr } = await supabase.storage
                .from("lesson-images")
                .upload(path, blob, { contentType: "image/jpeg", upsert: true });
              if (upErr) {
                console.warn("Upload vloženého obrázku selhal:", upErr);
                continue;
              }
              const { data: urlData } = supabase.storage.from("lesson-images").getPublicUrl(path);
              if (urlData?.publicUrl) {
                const list = pdfEmbeddedImagesByPage.get(pageNumber) ?? [];
                list.push(urlData.publicUrl);
                pdfEmbeddedImagesByPage.set(pageNumber, list);
              }
            }
          }
        } catch (err) {
          console.warn("PDF embedded image extraction failed:", err);
        }
      }

      // STEP 4: Send document to AI. Text-first: if we have enough extracted
      // text we do NOT resend the raw PDF bytes (which would let the model
      // "see" and re-describe decorative banners and duplicate the content).
      setProgress("AI analyzuje dokument...");
      const invokeBody: Record<string, unknown> = {
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        mode: singleLesson ? "single" : "split",
      };
      if (extractedText.length >= 100) {
        invokeBody.extractedText = extractedText;
      } else {
        invokeBody.fileBase64 = base64;
      }
      const { data, error } = await supabase.functions.invoke("process-file-content", {
        body: invokeBody,
      });

      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      const response = (data ?? {}) as {
        lessons?: { title?: string; blocks?: Block[] }[];
        blocks?: Block[];
        blockCount?: number;
        embeddedImages?: string[];
        skippedImages?: number;
      };

      let serverEmbedded = Array.isArray(response.embeddedImages) ? response.embeddedImages : [];
      const skippedImages = typeof response.skippedImages === "number" ? response.skippedImages : 0;

      // STEP 5: Classify all uploaded embedded images to filter out purely
      // decorative text banners (their info is already in the text stream).
      // One batched vision call for the whole document.
      const allEmbeddedUrls: string[] = [];
      for (const list of pdfEmbeddedImagesByPage.values()) allEmbeddedUrls.push(...list);
      allEmbeddedUrls.push(...serverEmbedded);

      let decorativeCount = 0;
      if (allEmbeddedUrls.length > 0) {
        try {
          setProgress(`AI třídí ${allEmbeddedUrls.length} obrázků (dekorativní text vs. obsah)...`);
          const { data: clsData, error: clsErr } = await supabase.functions.invoke("classify-images", {
            body: { urls: allEmbeddedUrls },
          });
          if (!clsErr) {
            const cls = (clsData ?? {}) as { classifications?: string[] };
            const list = Array.isArray(cls.classifications) ? cls.classifications : [];
            const keep = new Set<string>();
            for (let idx = 0; idx < allEmbeddedUrls.length; idx++) {
              const cat = list[idx];
              if (cat === "decorative_text") decorativeCount++;
              else keep.add(allEmbeddedUrls[idx]);
            }
            // Rewrite per-page map keeping only "content" images.
            for (const [pageNumber, urls] of pdfEmbeddedImagesByPage) {
              const filtered = urls.filter((u) => keep.has(u));
              if (filtered.length > 0) pdfEmbeddedImagesByPage.set(pageNumber, filtered);
              else pdfEmbeddedImagesByPage.delete(pageNumber);
            }
            serverEmbedded = serverEmbedded.filter((u) => keep.has(u));
          } else {
            console.warn("classify-images failed, keeping all images:", clsErr);
          }
        } catch (err) {
          console.warn("classify-images threw, keeping all images:", err);
        }
      }


      const makeImageBlock = (url: string, pageIdx: number): Block => ({
        id: crypto.randomUUID(),
        type: "image",
        visible: true,
        props: {
          url,
          caption: `Stránka ${pageIdx + 1}`,
          width: "full",
          alignment: "center",
        },
      } as unknown as Block);

      // Build a gallery block from a set of image URLs. Returns null if empty.
      const makeGalleryBlock = (urls: string[]): Block | null => {
        if (urls.length === 0) return null;
        return {
          id: crypto.randomUUID(),
          type: "gallery",
          visible: true,
          props: {
            columns: Math.min(3, Math.max(2, Math.ceil(Math.sqrt(urls.length)))),
            images: urls.map((url) => ({ url, caption: "" })),
          },
        } as unknown as Block;
      };

      // Insert per-page full-page renders AND per-page embedded-image galleries.
      // Page boundaries in the AI output are marked with `divider` blocks.
      // `usedPages` tracks which PDF pages were successfully placed inline so
      // the rest can be flushed at the end.
      const enrichBlocksWithPages = (blocks: Block[]): { blocks: Block[]; usedPages: Set<number> } => {
        const usedPages = new Set<number>();
        const placePageAssets = (out: Block[], pageIdx: number) => {
          // pageIdx is 0-based; PDF pageNumber is 1-based
          if (pageImageUrls[pageIdx]) out.push(makeImageBlock(pageImageUrls[pageIdx], pageIdx));
          const embedded = pdfEmbeddedImagesByPage.get(pageIdx + 1);
          if (embedded && embedded.length > 0) {
            const gallery = makeGalleryBlock(embedded);
            if (gallery) out.push(gallery);
            usedPages.add(pageIdx + 1);
          }
        };

        const out: Block[] = [];
        let pageIdx = 0;
        placePageAssets(out, 0);
        for (const block of blocks) {
          out.push(block);
          if ((block as any)?.type === "divider") {
            pageIdx++;
            placePageAssets(out, pageIdx);
          }
        }
        // Leftover full-page renders (AI produced fewer dividers than pages)
        for (let i = pageIdx + 1; i < pageImageUrls.length; i++) {
          if (pageImageUrls[i]) out.push(makeImageBlock(pageImageUrls[i], i));
        }
        return { blocks: out, usedPages };
      };

      const rawLessons = Array.isArray(response.lessons)
        ? response.lessons
        : response.blocks
          ? [{ title: file.name.replace(/\.(pdf|pptx|docx)$/i, ""), blocks: response.blocks }]
          : [];

      const lessons = rawLessons.map((lesson, idx) => {
        const base = Array.isArray(lesson.blocks) ? lesson.blocks : [];
        let placed = base;
        let usedPages = new Set<number>();
        if (idx === 0) {
          const enriched = enrichBlocksWithPages(base);
          placed = enriched.blocks;
          usedPages = enriched.usedPages;
        }
        // Fallback gallery on lesson 0: unmapped PDF pages + all DOCX/PPTX embedded
        const leftoverPdf: string[] = [];
        if (idx === 0) {
          for (const [pageNumber, urls] of pdfEmbeddedImagesByPage.entries()) {
            if (!usedPages.has(pageNumber)) leftoverPdf.push(...urls);
          }
        }
        const fallbackUrls = idx === 0 ? [...leftoverPdf, ...serverEmbedded] : [];
        const fallbackGallery = makeGalleryBlock(fallbackUrls);
        const withGallery = fallbackGallery ? [...placed, fallbackGallery] : placed;
        return { ...lesson, blocks: withGallery };
      });

      const normalizedLessons = lessons
        .map((lesson, index) => ({
          id: `draft-${index}-${Date.now()}`,
          title: (lesson.title || file.name.replace(/\.(pdf|pptx|docx)$/i, "")).trim() || `Lekce ${index + 1}`,
          blocks: Array.isArray(lesson.blocks) ? lesson.blocks : [],
          include: true,
        }))
        .filter((lesson) => lesson.blocks.length > 0);

      if (normalizedLessons.length === 0) {
        throw new Error("AI nedokázala z dokumentu extrahovat žádné editovatelné bloky.");
      }

      const totalBlocks = normalizedLessons.reduce((sum, lesson) => sum + lesson.blocks.length, 0);
      const pdfEmbeddedCount = Array.from(pdfEmbeddedImagesByPage.values()).reduce((s, arr) => s + arr.length, 0);
      const embeddedCount = pdfEmbeddedCount + serverEmbedded.length;
      setDrafts(normalizedLessons);
      const parts = [`Vytvořeno ${totalBlocks} bloků.`];
      if (embeddedCount > 0) parts.push(`Přidáno ${embeddedCount} obrázků rozprostřených po lekci.`);
      if (decorativeCount > 0) parts.push(`Odfiltrováno ${decorativeCount} dekorativních obrázků s textem.`);
      if (pagesNeedingRender.size > 0) parts.push(`${pagesNeedingRender.size} stránek vloženo jako obrázek (chybějící text).`);
      if (skippedImages > 0) parts.push(`Přeskočeno ${skippedImages} obrázků v nepodporovaném formátu (EMF/WMF).`);
      toast({
        title: "Import dokončen",
        description: parts.join(" "),
      });
    } catch (err: any) {
      console.error("Import error:", err);
      toast({
        title: "Import selhal",
        description: err?.message || "Neznámá chyba",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress("");
    }
  };

  const updateDraft = (id: string, patch: Partial<DraftLesson>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    const toImport = drafts.filter((d) => d.include && d.title.trim() && d.blocks.length > 0);
    if (toImport.length === 0) {
      toast({ title: "Není co uložit", description: "Vyberte alespoň jednu lekci.", variant: "destructive" });
      return;
    }
    if (!topicId) {
      toast({ title: "Vyberte téma", description: "Lekce musí být zařazené pod téma.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("textbook_lessons")
        .select("sort_order")
        .eq("topic_id", topicId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let nextOrder = existing && existing.length > 0 ? ((existing[0] as { sort_order?: number }).sort_order ?? 0) + 1 : 0;

      const payload = toImport.map((draft) => ({
        title: draft.title.trim().slice(0, 200),
        topic_id: topicId,
        sort_order: nextOrder++,
        blocks: draft.blocks as any,
        status: "draft",
      }));

      const { error } = await supabase.from("textbook_lessons").insert(payload);
      if (error) throw error;

      toast({ title: "Importováno", description: `Vytvořeno ${payload.length} lekcí.` });
      reset();
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      toast({ title: "Uložení selhalo", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Importovat soubor do učebnice
          </DialogTitle>
          <DialogDescription>
            Nahrajte PDF, DOCX nebo PPTX. AI přečte soubor a připraví editovatelné bloky, které si můžete před uložením upravit.
          </DialogDescription>
        </DialogHeader>

        {drafts.length === 0 ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={processing}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-2">
                  {file.name} ({(file.size / 1024).toFixed(0)} kB)
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Podporované formáty: PDF, DOCX, PPTX. Maximálně 25 MB. Soubor se bezpečně odešle do backendu k AI analýze.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">ℹ️ Co import zvládne:</p>
              <p>✅ Nadpisy, odstavce, seznamy, tabulky, citáty</p>
              <p>🖼️ Vložené obrázky (PDF/DOCX/PPTX) se přenesou jako galerie na konci lekce — v editoru je můžete přesunout ke správnému textu</p>
              <p className="text-xs">Poznámka: vektorové obrázky ve formátu EMF/WMF (staré PPTX) se přeskočí.</p>
              <p>📎 Podporované formáty: PDF, DOCX, PPTX (max 25 MB)</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="manual-text" className="text-sm">
                Pojistka: vložte text ručně (volitelné)
              </Label>
              <p className="text-xs text-muted-foreground">
                Pokud AI při importu vymýšlí obsah nebo přeskakuje text, otevřete PDF v prohlížeči, označte vše (Ctrl+A), zkopírujte (Ctrl+C) a vložte sem. Tento text má přednost před automatickou extrakcí.
              </p>
              <Textarea
                id="manual-text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={4}
                placeholder="Sem vložte přesný text z PDF / prezentace…"
                disabled={processing}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="single-lesson-toggle" className="text-sm">
                  Importovat jako jednu lekci
                </Label>
                <p className="text-xs text-muted-foreground">
                  {singleLesson
                    ? "Všechny stránky souboru se sloučí do jedné scrollovatelné lekce."
                    : "AI zkusí obsah rozdělit do více samostatných lekcí."}
                </p>
              </div>
              <Switch
                id="single-lesson-toggle"
                checked={singleLesson}
                onCheckedChange={setSingleLesson}
                disabled={processing}
              />
            </div>

            {processing && progress && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progress}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)} disabled={processing}>
                Zrušit
              </Button>
              <Button onClick={handleProcess} disabled={!file || processing}>
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI analyzuje dokument...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Zpracovat pomocí AI</>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Téma, do kterého importovat</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte téma" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.gradeLabel ? `${t.gradeLabel} – ${t.title}` : t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Návrhy lekcí ({drafts.filter((d) => d.include).length}/{drafts.length})
              </p>
              <Accordion type="multiple" className="border border-border rounded-lg">
                {drafts.map((d) => (
                  <AccordionItem key={d.id} value={d.id} className="px-3">
                    <div className="flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        checked={d.include}
                        onChange={(e) => updateDraft(d.id, { include: e.target.checked })}
                        className="w-4 h-4"
                        aria-label="Zahrnout lekci"
                      />
                      <Input
                        value={d.title}
                        onChange={(e) => updateDraft(d.id, { title: e.target.value })}
                        className="h-8 flex-1"
                        placeholder="Název lekce"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {d.blocks.length} bloků
                      </span>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                        title="Odstranit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <AccordionTrigger className="text-xs text-muted-foreground py-1">
                      Upravit obsah
                    </AccordionTrigger>
                    <AccordionContent>
                      <BlockEditor
                        blocks={d.blocks}
                        onChange={(blocks) => updateDraft(d.id, { blocks })}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={reset} disabled={saving}>
                Zpět
              </Button>
              <Button onClick={handleSave} disabled={saving || !topicId}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ukládám…</>
                ) : (
                  <>Uložit lekce</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportTextbookFileDialog;
