import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Camera, FileText, Wand2, ArrowLeft, X } from "lucide-react";
import { prepareJpegPhoto } from "@/lib/practice-photo";
import { checkAddBatch, kindForFile } from "@/lib/source-bundle";
import { extractFileSource, ScannedPdfError } from "@/lib/source-extract";
import { practiceErrorMessage, readablePracticeMessage } from "@/lib/practice-error";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import {
  emptyWorksheetSpec,
  createDefaultItem,
  createDefaultAnswerKey,
  nextItemId,
  recomputeMetadata,
} from "@/lib/worksheet-defaults";
import type { WorksheetItem, WorksheetSpec, ItemType, AnswerKeyEntry } from "@/lib/worksheet-spec";
import { readPracticeSource } from "@/lib/practice-method";

type Role = "teacher" | "student";
type OutputType = "worksheet" | "single_activity" | "activity_mix" | "presentation";

const ACTIVITY_TYPES: { value: ItemType; label: string }[] = [
  { value: "mcq", label: "Výběr z možností" },
  { value: "true_false", label: "Pravda / Nepravda" },
  { value: "fill_blank", label: "Doplňovačka" },
  { value: "matching", label: "Spojování" },
  { value: "ordering", label: "Seřazení" },
  { value: "short_answer", label: "Krátká odpověď" },
  { value: "flashcards", label: "Kartičky" },
  { value: "sorting", label: "Třídění do kategorií" },
  { value: "word_search", label: "Osmisměrka" },
];

function itemsToSpec(items: any[], title: string): WorksheetSpec {
  const spec = emptyWorksheetSpec({ title: title || "Aktivita z materiálu" });
  const built: WorksheetItem[] = items.map((aiItem: any, i: number) => {
    const type = (aiItem.type ?? "short_answer") as ItemType;
    const defaults = createDefaultItem(type, i + 1);
    const { id: _ignore, ...rest } = aiItem;
    return { ...defaults, ...rest, id: nextItemId(), type, itemNumber: i + 1 } as WorksheetItem;
  });
  const keys: AnswerKeyEntry[] = built.map((it, i) => {
    const aiItem: any = items[i] ?? {};
    const base = createDefaultAnswerKey(it);
    if (aiItem.correctAnswer !== undefined && aiItem.correctAnswer !== "") {
      return { ...base, correctAnswer: aiItem.correctAnswer };
    }
    return base;
  });
  spec.variants[0].items = built;
  spec.answerKeys[spec.variants[0].variantId] = keys;
  return recomputeMetadata(spec);
}

interface Props {
  role: Role;
}

export default function FromMaterialView({ role }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const requestedType = searchParams.get("typ");
  const handedSource = role === "student" && (requestedType === "flashcards" || requestedType === "mcq")
    ? readPracticeSource()
    : null;

  // Step 1: input
  const [images, setImages] = useState<{ file: File; preview: string; b64: string }[]>([]);
  const [extractedText, setExtractedText] = useState(handedSource?.text ?? "");
  const [sourceFileName, setSourceFileName] = useState(handedSource?.label ?? "");
  const [uploading, setUploading] = useState(false);
  const imageBusy = useRef(false);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => { imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview)); }, []);
  const cameraRef = useRef<HTMLInputElement>(null);
  const documentCount = useRef(0);

  // Step 2: choice
  const [outputType, setOutputType] = useState<OutputType>(
    role === "teacher" ? "worksheet" : "single_activity"
  );
  const [singleType, setSingleType] = useState<ItemType>(requestedType === "flashcards" ? "flashcards" : "mcq");
  const [mixTypes, setMixTypes] = useState<ItemType[]>(["mcq", "true_false"]);
  const [itemCount, setItemCount] = useState(8);
  const [title, setTitle] = useState(handedSource?.label?.replace(/^Bezlai\s*–\s*/, "") ?? "");

  const [generating, setGenerating] = useState(false);
  const [ephemeralSpec, setEphemeralSpec] = useState<WorksheetSpec | null>(null);

  const hasInput = (images.length > 0 || extractedText.trim().length > 20) && extractedText.length <= 20000 && !uploading;

  async function handleMixedPick(files: File[]) {
    const picked = Array.from(files);
    if (!picked.length || imageBusy.current) return;
    const existing = [...imagesRef.current.map(() => ({ kind: "photo" as const })), ...Array.from({ length: documentCount.current }, () => ({ kind: "pdf" as const }))];
    const error = checkAddBatch(existing, picked.map((f) => ({ kind: kindForFile(f), name: f.name, type: f.type, size: f.size })), { maxDocBytes: 25 * 1024 * 1024 });
    if (error) { toast({ title: error.includes("6 fotek") ? "Nejvýše 6 fotek" : "Zdroj se nepodařilo přidat", description: error, variant: "destructive" }); return; }
    imageBusy.current = true;
    setUploading(true);
    const addedImages: typeof images = [];
    const texts: string[] = [];
    const names: string[] = [];
    try {
      for (const original of picked) {
        try {
          const kind = kindForFile(original);
          if (!kind) continue;
          if (kind === "photo") {
            const photo = await prepareJpegPhoto(original);
            addedImages.push({ file: photo.file, preview: photo.preview, b64: photo.dataUrl });
          } else {
            // Same local extraction as SourceInput; scanned PDFs keep the existing server fallback.
            let text: string;
            try { text = await extractFileSource(original, kind); } catch (error) {
              if (!(error instanceof ScannedPdfError)) throw error;
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
                reader.onerror = () => reject(new Error("Soubor se nepodařilo načíst."));
                reader.readAsDataURL(original);
              });
              const { data, error: invokeError } = await supabase.functions.invoke("process-file-content", { body: { fileBase64: base64, fileName: original.name, mimeType: original.type || "application/pdf", mode: "single" } });
              if (invokeError) throw new Error(await practiceErrorMessage(invokeError));
              if (data?.error) throw new Error(readablePracticeMessage(data.error));
              const { curriculumBlocksToText } = await import("@/lib/curriculum-template");
              text = (data?.lessons ?? []).map((lesson: any) => curriculumBlocksToText(lesson.blocks ?? [])).join("\n\n");
            }
            if (text.trim().length < 20) throw new Error("Textu je málo, přidej další zdroj nebo text doplň ručně.");
            texts.push(text.trim()); names.push(original.name); documentCount.current++;
          }
        } catch (error) { toast({ title: "Zdroj se nepodařilo načíst", description: await practiceErrorMessage(error), variant: "destructive" }); }
      }
      if (addedImages.length) setImages((prev) => [...prev, ...addedImages]);
      if (texts.length) {
        setExtractedText((prev) => [prev, ...texts].filter(Boolean).join("\n\n"));
        setSourceFileName((prev) => [prev, ...names].filter(Boolean).join(", "));
        if (!title) setTitle(names[0]?.replace(/\.[^.]+$/, "") ?? "");
      }
    } finally { imageBusy.current = false; setUploading(false); }
  }

  async function callAi(): Promise<any> {
    const activityTypes =
      outputType === "single_activity"
        ? [singleType]
        : outputType === "activity_mix"
          ? mixTypes
          : undefined;

    const { data, error } = await supabase.functions.invoke("generate-content-from-material", {
      body: {
        images: images.map((i) => i.b64),
        extractedText,
        outputType,
        activityTypes,
        itemCount,
        title,
      },
    });
    if (error) throw new Error(await practiceErrorMessage(error));
    if ((data as any)?.error) throw new Error(readablePracticeMessage((data as any).error));
    return data;
  }

  async function handleGenerate() {
    if (!user) return;
    if (!hasInput) {
      toast({ title: "Přidej materiál", description: "Nahraj obrázek nebo dokument.", variant: "destructive" });
      return;
    }
    if (outputType === "activity_mix" && mixTypes.length < 2) {
      toast({ title: "Vyber alespoň 2 typy", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const data = await callAi();

      // ─── Presentation → new lesson_plan draft ───
      if (outputType === "presentation") {
        const aiSlides: any[] = (data as any)?.slides ?? [];
        if (aiSlides.length === 0) throw new Error("AI nevygenerovala žádné slidy.");
        const slides = aiSlides.map((s, i) => {
          if (s.type === "mcq") {
            const opts: string[] = Array.isArray(s.options) ? s.options.slice(0, 4) : [];
            while (opts.length < 4) opts.push(`Volba ${opts.length + 1}`);
            const correctIdx = Math.max(0, Math.min(3, Number(s.correctIndex ?? 0)));
            return {
              slideId: `mat-${Date.now()}-${i}`,
              type: "activity",
              projector: { headline: String(s.headline || "").trim(), body: "" },
              device: { instructions: "Vyberte správnou odpověď." },
              activitySpec: {
                activityType: "mcq",
                question: String(s.headline || "").trim(),
                options: opts.map((text, idx) => ({
                  text: String(text).trim(),
                  correct: idx === correctIdx,
                  isCorrect: idx === correctIdx,
                })),
                correctIndex: correctIdx,
              },
            };
          }
          return {
            slideId: `mat-${Date.now()}-${i}`,
            type: "explain",
            projector: {
              headline: String(s.headline || "").trim(),
              body: String(s.body || "").trim(),
            },
            device: { instructions: "Sledujte projektor." },
          };
        });

        const { data: created, error: iErr } = await supabase
          .from("lesson_plans")
          .insert({
            teacher_id: user.id,
            title: title || "Prezentace z materiálu",
            subject: "",
            grade_band: "",
            slides: slides as any,
            input_data: { source: "from-material", sourceFileName } as any,
            ai_generated: true,
            shared_visibility: "private",
            anonymous: false,
          } as any)
          .select("id")
          .single();
        if (iErr || !created) throw iErr ?? new Error("Nepodařilo se uložit plán.");
        toast({ title: "Prezentace vytvořena" });
        navigate(`/ucitel/plany-hodin/${(created as any).id}`);
        return;
      }

      // ─── Worksheet items output ───
      const aiItems: any[] = (data as any)?.items ?? [];
      if (aiItems.length === 0) throw new Error("AI nevygenerovala žádné bloky.");
      const aiTitle = (data as any)?.title || title || sourceFileName || "Aktivita z materiálu";
      const spec = itemsToSpec(aiItems, aiTitle);

      if (role === "teacher") {
        const { data: created, error: iErr } = await supabase
          .from("worksheets" as any)
          .insert({
            teacher_id: user.id,
            title: aiTitle,
            spec: spec as any,
            status: "draft",
            worksheet_mode: outputType === "worksheet" ? "classwork" : "revision",
            ai_generated: true,
          } as any)
          .select("id")
          .single();
        if (iErr || !created) throw iErr ?? new Error("Nepodařilo se uložit pracovní list.");
        toast({ title: "Pracovní list vytvořen", description: "Otevírám editor…" });
        navigate(`/ucitel/pracovni-listy/${(created as any).id}`);
        return;
      }

      // ─── Student: ephemeral local session ───
      setEphemeralSpec(spec);
      toast({ title: "Aktivita připravena", description: "Vyplň ji rovnou v prohlížeči." });
    } catch (err: any) {
      toast({
        title: "Chyba generování",
        description: await practiceErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  // ─── Render ephemeral student session ───
  if (ephemeralSpec) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{ephemeralSpec.header.title}</h1>
          <Button variant="outline" size="sm" onClick={() => setEphemeralSpec(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Toto je soukromé procvičování. Odpovědi se nikam neukládají a po zavření stránky zmizí.
        </p>
        <WorksheetPlayer
          spec={ephemeralSpec}
          variantId={ephemeralSpec.variants[0].variantId}
          attemptId={null}
          showResults
        />
      </div>
    );
  }

  const isTeacher = role === "teacher";

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Z materiálu</h1>
        <p className="text-muted-foreground mt-1">
          {isTeacher
            ? "Nahrajte fotku nebo dokument – AI vytvoří pracovní list, aktivitu nebo prezentaci."
            : "Nahraj fotku ze sešitu nebo dokument a AI ti připraví procvičování."}
        </p>
      </div>

      {/* Step 1 – input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Nahraj materiál</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-muted/40 transition-colors">
              <Camera className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-medium">Nahrát fotky z galerie</span>
              <span className="text-xs text-muted-foreground">Až 6 fotek</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; void handleMixedPick(picked); }}
              />
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-muted/40 transition-colors">
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="w-6 h-6 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Nahrát dokument</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX, XLSX, ODT, TXT a fotky</span>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.pptx,.xlsx,.odt,.odp,.txt,.md,image/jpeg,image/png,image/webp,.heic,.heif"
                className="hidden"
                onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; void handleMixedPick(picked); }}
                disabled={uploading}
              />
            </label>
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" disabled={uploading} className="hidden" onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; void handleMixedPick(picked); }} />
          <Button type="button" variant="outline" className="min-h-11" disabled={uploading} onClick={() => cameraRef.current?.click()}><Camera className="mr-2 h-4 w-4" />Vyfotit stránku</Button>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-md overflow-hidden border">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(img.preview); setImages((prev) => prev.filter((_, j) => j !== i)); }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                    aria-label="Odebrat"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {extractedText.length > 20000 && <p role="alert" className="text-sm text-destructive">Text má více než 20 000 znaků. Zkrať ho nebo rozděl do více dávek; žádný text nebyl oříznut.</p>}
          {extractedText && (
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-2">{sourceFileName || "text"}</Badge>
              Načteno {extractedText.length} znaků z dokumentu.
              <Textarea className="mt-2" rows={5} aria-label="Text materiálu" value={extractedText} onChange={(e) => setExtractedText(e.target.value)} disabled={uploading || generating} />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setExtractedText(""); setSourceFileName(""); documentCount.current = 0; }}>Odebrat dokumenty</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 – choice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Co má AI vytvořit?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={outputType} onValueChange={(v) => setOutputType(v as OutputType)}>
            {isTeacher && (
              <div className="flex items-start gap-2 py-1">
                <RadioGroupItem value="worksheet" id="opt-worksheet" />
                <div>
                  <Label htmlFor="opt-worksheet" className="font-medium cursor-pointer">
                    Pracovní list
                  </Label>
                  <p className="text-xs text-muted-foreground">Mix různých typů úloh.</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 py-1">
              <RadioGroupItem value="single_activity" id="opt-single" />
              <div className="flex-1">
                <Label htmlFor="opt-single" className="font-medium cursor-pointer">Aktivita jednoho typu</Label>
                <p className="text-xs text-muted-foreground">Jeden konkrétní typ úloh.</p>
                {outputType === "single_activity" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ACTIVITY_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setSingleType(t.value)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          singleType === t.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 py-1">
              <RadioGroupItem value="activity_mix" id="opt-mix" />
              <div className="flex-1">
                <Label htmlFor="opt-mix" className="font-medium cursor-pointer">Kombinace aktivit</Label>
                <p className="text-xs text-muted-foreground">Vyber 2+ typy, které chceš zkombinovat.</p>
                {outputType === "activity_mix" && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ACTIVITY_TYPES.map((t) => {
                      const checked = mixTypes.includes(t.value);
                      return (
                        <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setMixTypes((prev) =>
                                v ? [...prev, t.value] : prev.filter((x) => x !== t.value)
                              );
                            }}
                          />
                          {t.label}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {isTeacher && (
              <div className="flex items-start gap-2 py-1">
                <RadioGroupItem value="presentation" id="opt-presentation" />
                <div>
                  <Label htmlFor="opt-presentation" className="font-medium cursor-pointer">
                    Do prezentace
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Vygeneruje slidy pro živou prezentaci (uloží se jako nový plán hodiny).
                  </p>
                </div>
              </div>
            )}
          </RadioGroup>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div>
              <Label htmlFor="title" className="text-xs">Název (volitelně)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="např. Fotosyntéza"
              />
            </div>
            <div>
              <Label htmlFor="count" className="text-xs">Počet položek</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={20}
                value={itemCount}
                onChange={(e) => setItemCount(Math.max(1, Math.min(20, Number(e.target.value) || 8)))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleGenerate} disabled={!hasInput || generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Vygenerovat
        </Button>
      </div>
    </div>
  );
}
