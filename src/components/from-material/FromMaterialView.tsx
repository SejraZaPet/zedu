import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Camera, FileText, Wand2, ArrowLeft, X } from "lucide-react";
import { extractPdfText } from "@/lib/pdf-page-renderer";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import {
  emptyWorksheetSpec,
  createDefaultItem,
  createDefaultAnswerKey,
  nextItemId,
  recomputeMetadata,
} from "@/lib/worksheet-defaults";
import type { WorksheetItem, WorksheetSpec, ItemType, AnswerKeyEntry } from "@/lib/worksheet-spec";

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

function fileToBase64Raw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function blocksToText(blocks: any[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b: any) => {
      if (!b) return "";
      if (typeof b === "string") return b;
      if (typeof b.text === "string") return b.text;
      if (typeof b.content === "string") return b.content;
      if (typeof b.title === "string") return b.title;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

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
  const { user } = useAuth();
  const { toast } = useToast();

  // Step 1: input
  const [images, setImages] = useState<{ file: File; preview: string; b64: string }[]>([]);
  const [extractedText, setExtractedText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  // Step 2: choice
  const [outputType, setOutputType] = useState<OutputType>(
    role === "teacher" ? "worksheet" : "single_activity"
  );
  const [singleType, setSingleType] = useState<ItemType>("mcq");
  const [mixTypes, setMixTypes] = useState<ItemType[]>(["mcq", "true_false"]);
  const [itemCount, setItemCount] = useState(8);
  const [title, setTitle] = useState("");

  const [generating, setGenerating] = useState(false);
  const [ephemeralSpec, setEphemeralSpec] = useState<WorksheetSpec | null>(null);

  const hasInput = images.length > 0 || extractedText.trim().length > 20;

  async function handleImagePick(files: FileList | null) {
    if (!files) return;
    const items = await Promise.all(
      Array.from(files).slice(0, 6).map(async (file) => {
        const b64 = await fileToBase64Raw(file);
        const preview = URL.createObjectURL(file);
        return { file, preview, b64: `data:${file.type || "image/jpeg"};base64,${b64}` };
      })
    );
    setImages((prev) => [...prev, ...items].slice(0, 6));
    setExtractedText("");
  }

  async function handleDocumentPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const lower = file.name.toLowerCase();
      let text = "";
      if (lower.endsWith(".pdf")) {
        const res = await extractPdfText(file);
        text = res.text;
      }
      if (!text || text.length < 50) {
        const base64 = await fileToBase64Raw(file);
        const { data, error } = await supabase.functions.invoke("process-file-content", {
          body: {
            fileBase64: base64,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            mode: "single",
          },
        });
        if (error) throw error;
        const lessons = (data as any)?.lessons ?? [];
        text = lessons.map((l: any) => `${l.title || ""}\n${blocksToText(l.blocks || [])}`).join("\n\n");
      }
      if (!text || text.length < 20) {
        throw new Error("Ze souboru se nepodařilo extrahovat dostatek textu.");
      }
      setExtractedText(text.slice(0, 20000));
      setSourceFileName(file.name);
      setImages([]);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast({ title: "Text načten", description: `Extrahováno ${text.length} znaků.` });
    } catch (err: any) {
      toast({ title: "Chyba při načítání", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
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
        description: err?.message ?? String(err),
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
              <span className="text-sm font-medium">Vyfotit / nahrát obrázek</span>
              <span className="text-xs text-muted-foreground">Až 6 fotek</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleImagePick(e.target.files)}
              />
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-muted/40 transition-colors">
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="w-6 h-6 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Nahrát dokument</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX</span>
              <input
                type="file"
                accept=".pdf,.docx,.pptx"
                className="hidden"
                onChange={handleDocumentPick}
                disabled={uploading}
              />
            </label>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-md overflow-hidden border">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                    aria-label="Odebrat"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {extractedText && (
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-2">{sourceFileName || "text"}</Badge>
              Načteno {extractedText.length} znaků z dokumentu.
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
