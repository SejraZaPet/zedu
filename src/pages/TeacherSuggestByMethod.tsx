import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Upload, FileText, ArrowRight, Wand2, HelpCircle, Lightbulb } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { extractPdfText } from "@/lib/pdf-page-renderer";

interface LearningMethod {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  example: string | null;
  category: string | null;
  tips: string | null;
}

interface TeacherLesson {
  id: string;
  title: string;
  content_data: any;
}

interface PhaseValue {
  timeMin: string;
  description: string;
  activities?: { kind: string; title: string }[];
}

interface Suggestion {
  title: string;
  subject?: string;
  summary: string;
  phases: Record<string, PhaseValue>;
  methodNotes: { method_id: string; note: string }[];
}

const PHASE_LABELS: Record<string, string> = {
  uvod: "Úvod",
  motivace: "Motivace",
  hlavni: "Hlavní část",
  procviceni: "Procvičení",
  reflexe: "Reflexe",
  zaver: "Závěr",
};

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TeacherSuggestByMethod() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [methods, setMethods] = useState<LearningMethod[]>([]);
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([]);
  const [teacherLessons, setTeacherLessons] = useState<TeacherLesson[]>([]);
  const [sourceMode, setSourceMode] = useState<"text" | "lesson" | "file">("text");
  const [sourceText, setSourceText] = useState("");
  const [sourceLessonId, setSourceLessonId] = useState<string>("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("learning_methods")
        .select("id, slug, name, description, example, category, tips")
        .order("name");
      setMethods((data as any) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("teacher_textbook_lessons")
        .select("id, title, content_data, teacher_textbooks!inner(teacher_id)")
        .eq("teacher_textbooks.teacher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTeacherLessons(((data as any[]) ?? []).map((l) => ({ id: l.id, title: l.title, content_data: l.content_data })));
    })();
  }, [user]);

  const selectedMethods = useMemo(
    () => methods.filter((m) => selectedMethodIds.includes(m.id)),
    [methods, selectedMethodIds],
  );

  const toggleMethod = (id: string) => {
    setSelectedMethodIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        // fallback: server-side extraction via process-file-content
        const base64 = await fileToBase64(file);
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
        text = lessons
          .map((l: any) => `${l.title || ""}\n${blocksToText(l.blocks || [])}`)
          .join("\n\n");
      }
      if (!text || text.length < 20) {
        throw new Error("Ze souboru se nepodařilo vytáhnout dostatek textu.");
      }
      setSourceText(text.slice(0, 20000));
      setSourceTitle(file.name.replace(/\.[^.]+$/, ""));
      setSourceMode("text");
      toast({ title: "Text načten", description: `Extrahováno ${text.length} znaků.` });
    } catch (err: any) {
      toast({
        title: "Chyba při načítání souboru",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const resolveSourceText = (): { text: string; title: string } => {
    if (sourceMode === "lesson" && sourceLessonId) {
      const l = teacherLessons.find((x) => x.id === sourceLessonId);
      if (l) {
        const blocks = (l.content_data as any)?.blocks ?? l.content_data ?? [];
        return { text: blocksToText(Array.isArray(blocks) ? blocks : []), title: l.title };
      }
    }
    return { text: sourceText, title: sourceTitle };
  };

  const generate = async () => {
    if (selectedMethodIds.length === 0) {
      toast({ title: "Vyberte alespoň jednu metodu.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setSuggestion(null);
    try {
      const { text, title } = resolveSourceText();
      const { data, error } = await supabase.functions.invoke("suggest-lesson-from-methods", {
        body: {
          sourceText: text,
          sourceTitle: title,
          subject,
          gradeBand,
          customInstructions,
          methods: selectedMethods.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            tips: m.tips,
          })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSuggestion((data as any).suggestion);
    } catch (err: any) {
      toast({
        title: "Nepodařilo se vygenerovat návrh",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const createDraft = async () => {
    if (!user || !suggestion) return;
    setCreating(true);
    try {
      // Build phases in the shape TeacherLessonPlanEditor expects
      const phasesForEditor: Record<string, PhaseValue> = {};
      for (const key of Object.keys(PHASE_LABELS)) {
        const p = suggestion.phases?.[key];
        phasesForEditor[key] = {
          timeMin: p?.timeMin ?? "",
          description: p?.description ?? "",
          activities: p?.activities ?? [],
        };
      }

      const methodSummary = suggestion.methodNotes
        .map((n) => {
          const m = methods.find((x) => x.id === n.method_id);
          return m ? `• ${m.name}: ${n.note}` : null;
        })
        .filter(Boolean)
        .join("\n");

      const description = [
        suggestion.summary,
        "",
        "Pedagogické zdůvodnění metod:",
        methodSummary,
      ]
        .filter(Boolean)
        .join("\n");

      const { data, error } = await supabase
        .from("lesson_plans")
        .insert({
          teacher_id: user.id,
          title: suggestion.title || "Návrh podle metody",
          input_data: {
            description,
            subject: suggestion.subject || subject,
            phases: phasesForEditor,
            generatedFromMethods: selectedMethodIds,
            aiSource: "suggest-lesson-from-methods",
          } as any,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Link chosen methods to this lesson plan (best effort; ignore if table shape differs)
      try {
        const links = selectedMethodIds.map((mid) => ({
          method_id: mid,
          lesson_plan_id: (data as any).id,
        }));
        await supabase.from("lesson_method_links").insert(links as any);
      } catch (linkErr) {
        console.warn("lesson_method_links insert skipped:", linkErr);
      }

      toast({ title: "Draft plánu hodiny vytvořen." });
      navigate(`/ucitel/plany-hodin/${(data as any).id}`);
    } catch (err: any) {
      toast({
        title: "Nepodařilo se vytvořit draft",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-heading text-3xl font-bold">Návrh lekce podle metody</h1>
          </div>
          <p className="text-muted-foreground">
            Nahrajte materiál nebo vyberte lekci, zvolte jednu či více výukových metod a AI navrhne, jak lekci pojmout — včetně konkrétních procvičovacích aktivit.
          </p>
        </div>

        {/* Krok 1 – zdroj */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">1. Zdrojový materiál</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={sourceMode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceMode("text")}
              >
                <FileText className="w-4 h-4 mr-2" /> Vložit text
              </Button>
              <Button
                variant={sourceMode === "lesson" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceMode("lesson")}
              >
                Vybrat vlastní lekci
              </Button>
              <Button
                variant={sourceMode === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceMode("file")}
              >
                <Upload className="w-4 h-4 mr-2" /> Nahrát PDF / DOCX / PPTX
              </Button>
            </div>

            {sourceMode === "text" && (
              <>
                <div>
                  <Label htmlFor="src-title">Název tématu (nepovinné)</Label>
                  <Input
                    id="src-title"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="Např. Pythagorova věta"
                  />
                </div>
                <div>
                  <Label htmlFor="src-text">Text materiálu (výklad, poznámky, osnova)</Label>
                  <Textarea
                    id="src-text"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={10}
                    placeholder="Vložte text z prezentace, učebnice nebo vlastní přípravy…"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nepovinné. Bez textu AI navrhne obecnou strukturu podle metod. Max ~12 000 znaků.
                  </p>
                </div>
              </>
            )}

            {sourceMode === "lesson" && (
              <div>
                <Label>Vlastní lekce</Label>
                <Select value={sourceLessonId} onValueChange={setSourceLessonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte lekci…" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherLessons.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                    {teacherLessons.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">
                        Zatím nemáte žádné vlastní lekce.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sourceMode === "file" && (
              <div className="border-2 border-dashed rounded-xl p-6 text-center">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm mb-3">Podporované formáty: PDF, DOCX, PPTX (max 25 MB)</p>
                <Input
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="max-w-md mx-auto"
                />
                {uploading && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Extrahuji text…
                  </div>
                )}
                {sourceText && !uploading && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Načteno: <strong>{sourceTitle}</strong> ({sourceText.length} znaků)
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="subject">Předmět (nepovinné)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Např. Matematika"
                />
              </div>
              <div>
                <Label htmlFor="grade">Ročník / stupeň (nepovinné)</Label>
                <Input
                  id="grade"
                  value={gradeBand}
                  onChange={(e) => setGradeBand(e.target.value)}
                  placeholder="Např. 8. třída"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Krok 2 – metody */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              2. Výukové metody{" "}
              <span className="text-sm font-normal text-muted-foreground">
                (vyberte jednu nebo více)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {methods.map((m) => {
                const active = selectedMethodIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleMethod(m.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{m.name}</span>
                        {m.category && (
                          <Badge variant="secondary" className="text-xs">
                            {m.category}
                          </Badge>
                        )}
                        {(m.description || m.example) && (
                          <Popover>
                            <PopoverTrigger asChild onClick={(e) => e.preventDefault()}>
                              <button
                                type="button"
                                aria-label={`Nápověda: ${m.name}`}
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-80 text-sm space-y-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="font-semibold">{m.name}</div>
                              {m.description && (
                                <p className="text-muted-foreground whitespace-pre-line">
                                  {m.description}
                                </p>
                              )}
                              {m.example && (
                                <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    Příklad z hodiny
                                  </div>
                                  <p className="text-xs text-foreground/80 whitespace-pre-line">
                                    {m.example}
                                  </p>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">Katalog metod se načítá…</p>
              )}
            </div>

            <div className="mt-4">
              <Label htmlFor="custom">Doplňující pokyny (nepovinné)</Label>
              <Textarea
                id="custom"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
                placeholder="Např. „Preferuji krátký úvod a hodně aktivit ve skupinách.“"
              />
            </div>
          </CardContent>
        </Card>

        {/* Krok 3 – generovat */}
        <div className="flex justify-center mb-8">
          <Button
            size="lg"
            variant="hero"
            onClick={generate}
            disabled={generating || selectedMethodIds.length === 0}
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {generating ? "Generuji návrh…" : "Vygenerovat návrh lekce"}
          </Button>
        </div>

        {/* Výstup */}
        {suggestion && (
          <Card className="mb-6 border-primary/30">
            <CardHeader>
              <CardTitle className="text-xl">{suggestion.title}</CardTitle>
              <p className="text-muted-foreground mt-2">{suggestion.summary}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(PHASE_LABELS).map(([key, label]) => {
                  const p = suggestion.phases?.[key];
                  if (!p) return null;
                  return (
                    <div key={key} className="border rounded-lg p-4 bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{label}</h3>
                        {p.timeMin && (
                          <Badge variant="outline" className="text-xs">
                            {p.timeMin} min
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mb-3">{p.description}</p>
                      {p.activities && p.activities.length > 0 && (
                        <ul className="text-sm space-y-1">
                          {p.activities.map((a, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <span>
                                <strong className="text-xs uppercase text-muted-foreground mr-1">
                                  {a.kind}
                                </strong>
                                {a.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {suggestion.methodNotes?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Proč tyto metody sedí</h3>
                  <ul className="space-y-2">
                    {suggestion.methodNotes.map((n, i) => {
                      const m = methods.find((x) => x.id === n.method_id);
                      return (
                        <li key={i} className="text-sm">
                          <strong>{m?.name ?? "Metoda"}:</strong> {n.note}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button onClick={createDraft} disabled={creating} className="gap-2">
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Vytvořit plán hodiny z tohoto návrhu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
