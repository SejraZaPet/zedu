import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, HelpCircle, MessageSquare, Cloud, DoorOpen, ArrowLeft, Loader2, Users2, SplitSquareHorizontal, Sparkles, Plus, Trash2, KeyRound, Library, Zap, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchGameTemplates, purposeLabel, type GameTemplate } from "@/lib/game-templates";

type AddKind = "menu" | "text" | "mcq" | "wall" | "wordcloud" | "exit" | "teams" | "differentiated" | "escape" | "library" | "bezlistart";

const BEZLISTART_TAGLINE = "Krátká aktivita na rozproudění myšlení";

const BEZLISTART_CATEGORY_LABELS: Record<string, string> = {
  vizualni: "Vizuální",
  verbalni: "Verbální",
  pohybova: "Pohybová",
  tymova: "Týmová",
  jina: "Jiná",
};

interface BezliStartPrompt {
  id: string;
  category: string | null;
  prompt_text: string;
  suggested_duration_minutes: number;
}

const EXIT_TICKET_DEFAULT_PROMPT =
  "Napiš jednu věc, kterou sis dnes odnesl/a, a jednu věc, která ti ještě není jasná.";

interface AddSlideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live session the slide is appended to. Omit when using `onAddSlides`. */
  sessionId?: string;
  slides: any[];
  /**
   * ČÁST 4b – v editoru prezentací nabízí jen layoutové šablony slidů;
   * aktivity se vkládají výhradně ze záložky „Aktivity“ v levém railu.
   */
  layoutsOnly?: boolean;

  /**
   * When provided, built slides are handed over instead of being written to a
   * live session (used by the game library editor / presentation editor).
   */
  onAddSlides?: (newSlides: any[]) => void | Promise<void>;
}


function buildTextSlide(headline: string, body: string) {
  return {
    slideId: `live-${Date.now()}`,
    type: "explain",
    projector: { headline: headline.trim(), body: body.trim() },
    device: { instructions: "Sledujte projektor." },
  };
}

function buildMcqSlide(question: string, options: string[], correctIdx: number) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: question.trim(), body: "" },
    device: { instructions: "Vyberte správnou odpověď." },
    activitySpec: {
      activityType: "mcq",
      question: question.trim(),
      options: options.map((text, i) => ({
        text: text.trim(),
        correct: i === correctIdx,
        isCorrect: i === correctIdx,
      })),
      correctIndex: correctIdx,
    },
  };
}

function buildWallSlide(prompt: string, anonymous: boolean) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: prompt.trim(), body: "" },
    device: { instructions: "Napište svou odpověď." },
    activitySpec: {
      activityType: "wall",
      question: prompt.trim(),
      anonymous,
      allowMultiple: false,
    },
  };
}

function buildWordcloudSlide(prompt: string, anonymous: boolean) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: prompt.trim(), body: "" },
    device: { instructions: "Pošlete slovo nebo krátkou frázi." },
    activitySpec: {
      activityType: "wordcloud",
      question: prompt.trim(),
      anonymous,
    },
  };
}

function buildTeamsSlide(mode: "random" | "manual", count: number) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: "Rozdělení do skupin", body: "" },
    device: { instructions: "Podívej se, ve které jsi skupině." },
    activitySpec: {
      activityType: "teams",
      teamMode: mode,
      teamCount: Math.max(2, Math.min(6, count)),
    },
  };
}

function buildDifferentiatedSlide(
  topic: string,
  tasks: { title: string; content: string }[],
  teamCount: number,
) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: topic.trim() || "Diferencovaná aktivita", body: "" },
    device: { instructions: "Podívej se na úkol pro svou skupinu." },
    activitySpec: {
      activityType: "differentiated",
      topic: topic.trim(),
      tasks: tasks.map((t) => ({
        title: (t.title || "").trim(),
        content: (t.content || "").trim(),
      })),
      teamCount: Math.max(2, Math.min(6, teamCount)),
    },
  };
}

function buildEscapeSlide(
  intro: string,
  locks: { clue: string; code: string }[],
  finalMessage: string,
) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: "Úniková hra", body: "" },
    device: { instructions: "Vyluští postupně všechny zámky." },
    activitySpec: {
      activityType: "escape",
      intro: intro.trim(),
      locks: locks.map((l) => ({ clue: l.clue.trim(), code: l.code.trim() })),
      finalMessage: finalMessage.trim(),
    },
  };
}


export function AddSlideSheet({
  open,
  onOpenChange,
  sessionId,
  slides,
  onAddSlides,
  layoutsOnly = false,
}: AddSlideSheetProps) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<AddKind>("menu");
  const [zsPrompts, setZsPrompts] = useState<BezliStartPrompt[]>([]);
  const [zsLoading, setZsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);


  // text
  const [textHeadline, setTextHeadline] = useState("");
  const [textBody, setTextBody] = useState("");

  // mcq
  const [mcqQuestion, setMcqQuestion] = useState("");
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrect, setMcqCorrect] = useState(0);

  // wall
  const [wallPrompt, setWallPrompt] = useState("");
  const [wallAnonymous, setWallAnonymous] = useState(true);

  // wordcloud
  const [wcPrompt, setWcPrompt] = useState("");
  const [wcAnonymous, setWcAnonymous] = useState(true);

  // teams
  const [teamsMode, setTeamsMode] = useState<"random" | "manual">("random");
  const [teamsCount, setTeamsCount] = useState(2);

  // differentiated
  const [diffTopic, setDiffTopic] = useState("");
  const [diffCount, setDiffCount] = useState(3);
  const [diffTasks, setDiffTasks] = useState<{ title: string; content: string }[]>([
    { title: "", content: "" },
    { title: "", content: "" },
    { title: "", content: "" },
  ]);
  const [diffLoading, setDiffLoading] = useState(false);

  // escape
  const [escapeIntro, setEscapeIntro] = useState("");
  const [escapeFinal, setEscapeFinal] = useState("");
  const [escapeLocks, setEscapeLocks] = useState<{ clue: string; code: string }[]>([
    { clue: "", code: "" },
    { clue: "", code: "" },
    { clue: "", code: "" },
  ]);

  const reset = () => {
    setKind("menu");
    setTextHeadline("");
    setTextBody("");
    setMcqQuestion("");
    setMcqOptions(["", "", "", ""]);
    setMcqCorrect(0);
    setWallPrompt("");
    setWallAnonymous(true);
    setWcPrompt("");
    setWcAnonymous(true);
    setTeamsMode("random");
    setTeamsCount(2);
    setDiffTopic("");
    setDiffCount(3);
    setDiffTasks([
      { title: "", content: "" },
      { title: "", content: "" },
      { title: "", content: "" },
    ]);
    setDiffLoading(false);
    setEscapeIntro("");
    setEscapeFinal("");
    setEscapeLocks([
      { clue: "", code: "" },
      { clue: "", code: "" },
      { clue: "", code: "" },
    ]);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const appendMany = async (added: any[]) => {
    if (added.length === 0) return;
    setBusy(true);
    try {
      if (onAddSlides) {
        await onAddSlides(added);
        toast.success(added.length > 1 ? "Slidy přidány." : "Slide přidán.");
        close();
        return;
      }
      if (!sessionId) throw new Error("Chybí session.");
      const newSlides = [...(slides || []), ...added];
      const newIndex = newSlides.length - added.length;
      const { error } = await supabase
        .from("game_sessions")
        .update({
          activity_data: newSlides as any,
          current_question_index: newIndex,
          question_started_at: new Date().toISOString(),
          status: "playing",
        })
        .eq("id", sessionId);
      if (error) throw error;
      toast.success("Slide přidán a zobrazen.");
      close();
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se přidat slide.");
    } finally {
      setBusy(false);
    }
  };

  const appendAndJump = (newSlide: any) => appendMany([newSlide]);

  const openLibrary = async () => {
    setKind("library");
    setTemplatesLoading(true);
    try {
      setTemplates(await fetchGameTemplates());
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se načíst knihovnu her.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const insertTemplate = (tpl: GameTemplate) => {
    const tplSlides = Array.isArray(tpl.activity_data) ? tpl.activity_data : [];
    if (tplSlides.length === 0) {
      toast.error("Tato hra neobsahuje žádný obsah.");
      return;
    }
    const stamped = tplSlides.map((s: any, i: number) => ({
      ...s,
      slideId: `lib-${Date.now()}-${i}`,
    }));
    appendMany(stamped);
  };


  const fetchBezliStartPrompts = async (): Promise<BezliStartPrompt[]> => {
    const { data, error } = await supabase
      .from("zedstart_prompts")
      .select("id, category, prompt_text, suggested_duration_minutes")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as BezliStartPrompt[]) ?? [];
  };

  const insertBezliStart = (prompt: BezliStartPrompt) =>
    appendAndJump(buildWallSlide(prompt.prompt_text, true));

  const startBezliStartRandom = async () => {
    setZsLoading(true);
    try {
      const list = await fetchBezliStartPrompts();
      setZsPrompts(list);
      if (list.length === 0) {
        setKind("bezlistart");
        return;
      }
      insertBezliStart(list[Math.floor(Math.random() * list.length)]);
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se načíst BezliStart aktivity.");
    } finally {
      setZsLoading(false);
    }
  };

  const openBezliStartPicker = async () => {
    setKind("bezlistart");
    setZsLoading(true);
    try {
      setZsPrompts(await fetchBezliStartPrompts());
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se načíst BezliStart aktivity.");
    } finally {
      setZsLoading(false);
    }
  };

  const submitText = () => {
    if (!textHeadline.trim()) {
      toast.error("Doplňte nadpis.");
      return;
    }
    appendAndJump(buildTextSlide(textHeadline, textBody));
  };

  const submitMcq = () => {
    if (!mcqQuestion.trim()) {
      toast.error("Doplňte otázku.");
      return;
    }
    const filled = mcqOptions.filter((o) => o.trim()).length;
    if (filled < 2) {
      toast.error("Doplňte alespoň 2 možnosti.");
      return;
    }
    if (!mcqOptions[mcqCorrect]?.trim()) {
      toast.error("Označte správnou odpověď z vyplněných možností.");
      return;
    }
    appendAndJump(buildMcqSlide(mcqQuestion, mcqOptions, mcqCorrect));
  };

  const submitWall = () => {
    if (!wallPrompt.trim()) {
      toast.error("Doplňte zadání.");
      return;
    }
    appendAndJump(buildWallSlide(wallPrompt, wallAnonymous));
  };

  const submitWordcloud = () => {
    if (!wcPrompt.trim()) {
      toast.error("Doplňte zadání.");
      return;
    }
    appendAndJump(buildWordcloudSlide(wcPrompt, wcAnonymous));
  };

  const submitTeams = () => {
    appendAndJump(buildTeamsSlide(teamsMode, teamsCount));
  };

  const syncDiffTasksCount = (n: number) => {
    setDiffCount(n);
    setDiffTasks((prev) => {
      const next = [...prev];
      if (next.length < n) {
        while (next.length < n) next.push({ title: "", content: "" });
      } else if (next.length > n) {
        next.length = n;
      }
      return next;
    });
  };

  const runDiffAi = async () => {
    if (!diffTopic.trim()) {
      toast.error("Doplňte téma/zadání.");
      return;
    }
    setDiffLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-differentiated-tasks", {
        body: { topic: diffTopic, teamCount: diffCount },
      });
      if (error) throw error;
      const tasks = Array.isArray((data as any)?.tasks) ? (data as any).tasks : [];
      if (tasks.length === 0) throw new Error("AI nevrátila žádné varianty.");
      const filled: { title: string; content: string }[] = [];
      for (let i = 0; i < diffCount; i++) {
        const t = tasks[i] || { title: `Varianta ${i + 1}`, content: diffTopic };
        filled.push({ title: String(t.title || ""), content: String(t.content || "") });
      }
      setDiffTasks(filled);
      toast.success("Varianty vygenerovány. Můžete je před uložením upravit.");
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se vygenerovat varianty.");
    } finally {
      setDiffLoading(false);
    }
  };

  const submitDifferentiated = () => {
    if (!diffTopic.trim()) {
      toast.error("Doplňte téma/zadání.");
      return;
    }
    const tasks = diffTasks.slice(0, diffCount);
    if (tasks.some((t) => !t.title.trim() || !t.content.trim())) {
      toast.error("Vyplňte název i zadání pro každou variantu (nebo použijte AI).");
      return;
    }
    appendAndJump(buildDifferentiatedSlide(diffTopic, tasks, diffCount));
  };

  const submitEscape = () => {
    const filled = escapeLocks.filter((l) => l.clue.trim() && l.code.trim());
    if (filled.length < 3) {
      toast.error("Vyplňte alespoň 3 zámky (hádanka + kód).");
      return;
    }
    if (filled.length > 6) {
      toast.error("Maximálně 6 zámků.");
      return;
    }
    appendAndJump(buildEscapeSlide(escapeIntro, filled, escapeFinal));
  };



  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            {kind !== "menu" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setKind("menu")}
                disabled={busy}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <SheetTitle>
              {kind === "menu" && "Přidat slide"}
              {kind === "text" && "Textový slide"}
              {kind === "mcq" && "Otázka (MCQ)"}
              {kind === "wall" && "Zeď aktivita"}
              {kind === "wordcloud" && "Slovní mrak"}
              {kind === "exit" && "Exit ticket"}
              {kind === "teams" && "Rozdělit do skupin"}
              {kind === "differentiated" && "Diferencovaná aktivita"}
              {kind === "escape" && "Úniková hra"}
              {kind === "library" && "Vložit z knihovny her"}
              {kind === "bezlistart" && "BezliStart"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {onAddSlides
              ? "Slide bude přidán do obsahu, který právě sestavujete."
              : "Slide bude přidán na konec živé prezentace a okamžitě zobrazen žákům. Původní lekce zůstane beze změny."}
          </SheetDescription>

        </SheetHeader>

        <div className="mt-6 space-y-4">
          {kind === "menu" && (
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                disabled={busy}
                onClick={() =>
                  appendAndJump({
                    slideId: crypto.randomUUID(),
                    type: "content",
                    projector: { headline: "", body: "" },
                    device: { instructions: "" },
                    blocks: [],
                  })
                }
              >
                <Square className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Prázdný slide</p>
                  <p className="text-xs text-muted-foreground">
                    Čistá plocha — obsah doplníte přímo v editoru
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("text")}
              >
                <FileText className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Textový slide</p>
                  <p className="text-xs text-muted-foreground">
                    Nadpis a krátký výklad nebo poznámka
                  </p>
                </div>
              </Button>
{!layoutsOnly && (<>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("mcq")}
              >
                <HelpCircle className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Otázka</p>
                  <p className="text-xs text-muted-foreground">
                    Rychlá MCQ se 4 možnostmi
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("wall")}
              >
                <MessageSquare className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Zeď aktivita</p>
                  <p className="text-xs text-muted-foreground">
                    Žáci píší krátké odpovědi na zeď
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("wordcloud")}
              >
                <Cloud className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Slovní mrak</p>
                  <p className="text-xs text-muted-foreground">
                    Žáci pošlou slovo/frázi, roste společný mrak
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => {
                  setWallPrompt(EXIT_TICKET_DEFAULT_PROMPT);
                  setWallAnonymous(true);
                  setKind("exit");
                }}
              >
                <DoorOpen className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Exit ticket</p>
                  <p className="text-xs text-muted-foreground">
                    Rychlá šablona na konec hodiny
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("teams")}
              >
                <Users2 className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Rozdělit do skupin</p>
                  <p className="text-xs text-muted-foreground">
                    Náhodně nebo ručně rozděl třídu na menší skupiny
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("differentiated")}
              >
                <SplitSquareHorizontal className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Diferencovaná aktivita</p>
                  <p className="text-xs text-muted-foreground">
                    Každá skupina dostane jiný úkol (volitelně s AI)
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("escape")}
              >
                <KeyRound className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Úniková hra</p>
                  <p className="text-xs text-muted-foreground">
                    Série hádanek, které žáci luští postupně
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                disabled={busy || zsLoading}
                onClick={startBezliStartRandom}
              >
                {zsLoading ? (
                  <Loader2 className="w-5 h-5 mr-3 animate-spin text-primary" />
                ) : (
                  <Zap className="w-5 h-5 mr-3 text-primary" />
                )}
                <div className="text-left">
                  <p className="font-medium">BezliStart</p>
                  <p className="text-xs text-muted-foreground">{BEZLISTART_TAGLINE}</p>
                </div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start -mt-1 text-xs text-muted-foreground"
                disabled={busy || zsLoading}
                onClick={openBezliStartPicker}
              >
                Vybrat konkrétní BezliStart…
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={openLibrary}
              >
                <Library className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Vložit z knihovny her</p>
                  <p className="text-xs text-muted-foreground">
                    Použij hotovou hru nebo aktivitu z „Moje hry"
                  </p>
                </div>
              </Button>
</>)}
            </div>
          )}

          {kind === "library" && (
            <div className="space-y-2">
              {templatesLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Načítání knihovny…
                </p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  V knihovně zatím nemáte žádnou hru. Vytvořte ji v sekci „Moje hry".
                </p>
              ) : (
                templates.map((tpl) => (
                  <Button
                    key={tpl.id}
                    variant="outline"
                    className="justify-start h-auto py-3 w-full"
                    disabled={busy}
                    onClick={() => insertTemplate(tpl)}
                  >
                    <div className="text-left">
                      <p className="font-medium">{tpl.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {purposeLabel(tpl.purpose)} ·{" "}
                        {Array.isArray(tpl.activity_data) ? tpl.activity_data.length : 0} slidů
                      </p>
                    </div>
                  </Button>
                ))
              )}
            </div>
          )}



          {kind === "bezlistart" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{BEZLISTART_TAGLINE}</p>
              {zsLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Načítání aktivit…
                </p>
              ) : zsPrompts.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Zatím nemáte žádné BezliStart aktivity – přidejte je na /ucitel/bezlistart.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      close();
                      navigate("/ucitel/bezlistart");
                    }}
                  >
                    Přejít na BezliStart
                  </Button>
                </div>
              ) : (
                zsPrompts.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="justify-start h-auto py-3 w-full whitespace-normal"
                    disabled={busy}
                    onClick={() => insertBezliStart(p)}
                  >
                    <div className="text-left">
                      <p className="font-medium">{p.prompt_text}</p>
                      <p className="text-xs text-muted-foreground">
                        {BEZLISTART_CATEGORY_LABELS[p.category ?? "jina"] ?? "Jiná"} ·{" "}
                        {p.suggested_duration_minutes} min
                      </p>
                    </div>
                  </Button>
                ))
              )}
            </div>
          )}

          {kind === "text" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="text-headline">Nadpis</Label>
                <Input
                  id="text-headline"
                  value={textHeadline}
                  onChange={(e) => setTextHeadline(e.target.value)}
                  placeholder="Např. Shrnutí kapitoly"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="text-body">Text</Label>
                <Textarea
                  id="text-body"
                  rows={6}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  placeholder="Volitelný text. Můžete použít odrážky • na začátku řádku."
                  disabled={busy}
                />
              </div>
              <Button onClick={submitText} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "mcq" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mcq-q">Otázka</Label>
                <Textarea
                  id="mcq-q"
                  rows={2}
                  value={mcqQuestion}
                  onChange={(e) => setMcqQuestion(e.target.value)}
                  placeholder="Zadejte otázku"
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label>Možnosti (vyberte správnou)</Label>
                <RadioGroup
                  value={String(mcqCorrect)}
                  onValueChange={(v) => setMcqCorrect(Number(v))}
                >
                  {mcqOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <RadioGroupItem value={String(i)} id={`mcq-opt-${i}`} />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...mcqOptions];
                          next[i] = e.target.value;
                          setMcqOptions(next);
                        }}
                        placeholder={`Možnost ${i + 1}`}
                        disabled={busy}
                      />
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <Button onClick={submitMcq} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "wall" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wall-prompt">Zadání</Label>
                <Textarea
                  id="wall-prompt"
                  rows={3}
                  value={wallPrompt}
                  onChange={(e) => setWallPrompt(e.target.value)}
                  placeholder="Např. Co vás dnes nejvíc zaujalo?"
                  disabled={busy}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={wallAnonymous}
                  onChange={(e) => setWallAnonymous(e.target.checked)}
                  disabled={busy}
                />
                Anonymní odpovědi
              </label>
              <Button onClick={submitWall} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "wordcloud" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wc-prompt">Zadání</Label>
                <Textarea
                  id="wc-prompt"
                  rows={3}
                  value={wcPrompt}
                  onChange={(e) => setWcPrompt(e.target.value)}
                  placeholder="Např. Jedním slovem popište, co jste se dnes naučili"
                  disabled={busy}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={wcAnonymous}
                  onChange={(e) => setWcAnonymous(e.target.checked)}
                  disabled={busy}
                />
                Anonymní
              </label>
              <Button onClick={submitWordcloud} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "exit" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Šablona vytvoří anonymní zeď s otázkou reflektující dnešní hodinu. Zadání můžete upravit.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="exit-prompt">Zadání</Label>
                <Textarea
                  id="exit-prompt"
                  rows={3}
                  value={wallPrompt}
                  onChange={(e) => setWallPrompt(e.target.value)}
                  disabled={busy}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={wallAnonymous}
                  onChange={(e) => setWallAnonymous(e.target.checked)}
                  disabled={busy}
                />
                Anonymní odpovědi
              </label>
              <Button onClick={submitWall} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "teams" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Rozděl třídu do menších skupin pro skupinovou práci. Rozdělení
                se uloží do session a zobrazí se na projektoru i žákům.
              </p>
              <div className="space-y-1.5">
                <Label>Způsob rozdělení</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "random", label: "Náhodně", desc: "Automaticky" },
                    { id: "manual", label: "Ručně", desc: "Drag & drop" },
                  ] as const).map((opt) => {
                    const active = teamsMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTeamsMode(opt.id)}
                        disabled={busy}
                        className={cn(
                          "rounded-lg border p-3 text-left transition",
                          active
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teams-count">Počet skupin</Label>
                <select
                  id="teams-count"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={teamsCount}
                  onChange={(e) => setTeamsCount(parseInt(e.target.value, 10))}
                  disabled={busy}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <Button onClick={submitTeams} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "differentiated" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Každá skupina uvidí JEN svůj úkol. Můžete varianty vygenerovat pomocí AI
                nebo je zadat ručně. Rozdělení do skupin proběhne automaticky po zobrazení
                slidu (žáky lze potom případně přeskupit).
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="diff-topic">Téma / společné zadání</Label>
                <Textarea
                  id="diff-topic"
                  rows={3}
                  value={diffTopic}
                  onChange={(e) => setDiffTopic(e.target.value)}
                  placeholder="Např. Vypočítejte obsah trojúhelníku"
                  disabled={busy || diffLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="diff-count">Počet skupin</Label>
                <select
                  id="diff-count"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={diffCount}
                  onChange={(e) => syncDiffTasksCount(parseInt(e.target.value, 10))}
                  disabled={busy || diffLoading}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={runDiffAi}
                disabled={busy || diffLoading}
              >
                {diffLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Vygenerovat pomocí AI
              </Button>

              <div className="space-y-2">
                <Label>Varianty úkolu ({diffCount})</Label>
                <p className="text-xs text-muted-foreground">
                  Můžete každou variantu ručně upravit.
                </p>
                {diffTasks.slice(0, diffCount).map((task, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Skupina {i + 1}
                      </span>
                    </div>
                    <Input
                      value={task.title}
                      onChange={(e) => {
                        const next = [...diffTasks];
                        next[i] = { ...next[i], title: e.target.value };
                        setDiffTasks(next);
                      }}
                      placeholder="Krátký název úkolu"
                      disabled={busy || diffLoading}
                    />
                    <Textarea
                      rows={3}
                      value={task.content}
                      onChange={(e) => {
                        const next = [...diffTasks];
                        next[i] = { ...next[i], content: e.target.value };
                        setDiffTasks(next);
                      }}
                      placeholder="Konkrétní zadání pro tuto skupinu"
                      disabled={busy || diffLoading}
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={submitDifferentiated}
                disabled={busy || diffLoading}
                className="w-full"
              >
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "escape" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Digitální úniková hra: žáci luští 3–6 zámků postupně. Kód se porovnává
                bez ohledu na velikost písmen a mezery. Postup běží lokálně, není skórován.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="escape-intro">Úvodní příběh / scénář (volitelné)</Label>
                <Textarea
                  id="escape-intro"
                  rows={3}
                  value={escapeIntro}
                  onChange={(e) => setEscapeIntro(e.target.value)}
                  placeholder="Např. Jste zavření v knihovně. Abyste unikli, musíte odemknout několik zámků…"
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Zámky ({escapeLocks.length})</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEscapeLocks((prev) =>
                          prev.length < 6 ? [...prev, { clue: "", code: "" }] : prev
                        )
                      }
                      disabled={busy || escapeLocks.length >= 6}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Přidat zámek
                    </Button>
                  </div>
                </div>
                {escapeLocks.map((lock, i) => (
                  <div key={i} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Zámek {i + 1}
                      </span>
                      {escapeLocks.length > 3 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() =>
                            setEscapeLocks((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          disabled={busy}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      rows={2}
                      value={lock.clue}
                      onChange={(e) => {
                        const next = [...escapeLocks];
                        next[i] = { ...next[i], clue: e.target.value };
                        setEscapeLocks(next);
                      }}
                      placeholder="Hádanka / nápověda"
                      disabled={busy}
                    />
                    <Input
                      value={lock.code}
                      onChange={(e) => {
                        const next = [...escapeLocks];
                        next[i] = { ...next[i], code: e.target.value };
                        setEscapeLocks(next);
                      }}
                      placeholder="Kód k odemknutí (např. 42 nebo Praha)"
                      disabled={busy}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="escape-final">Závěrečný vzkaz (volitelné)</Label>
                <Textarea
                  id="escape-final"
                  rows={3}
                  value={escapeFinal}
                  onChange={(e) => setEscapeFinal(e.target.value)}
                  placeholder="Např. Gratulujeme! Unikli jste."
                  disabled={busy}
                />
              </div>

              <Button onClick={submitEscape} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
