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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Upload, FileText, ArrowRight, Wand2, HelpCircle, Lightbulb, MonitorPlay } from "lucide-react";
import InsertSlidesIntoPresentationDialog from "@/components/presentation/InsertSlidesIntoPresentationDialog";
import { phasesToSlides } from "@/lib/plan-to-slides";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { extractPdfText } from "@/lib/pdf-page-renderer";
import { loadTeacherLessonOptions } from "@/lib/teacher-lesson-catalog";
import { normalizeBlocks, type Block } from "@/lib/textbook-config";
import { savePlanEquipment } from "@/lib/lesson-plan-equipment";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import { BookOpen } from "lucide-react";

interface LearningMethod {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  example: string | null;
  category: string | null;
  tips: string | null;
}

type TeacherSourceKind = "lesson" | "catalog" | "plan" | "worksheet";

interface TeacherSource {
  id: string;
  title: string;
  kind: TeacherSourceKind;
  content: any;
  /** Popisek zdroje (učebnice / téma) pro seznam a náhled. */
  source?: string;
  /** Předmět pro filtr a seskupení. */
  subject?: string | null;
  /** U lekcí: čisté id lekce (bez prefixu). */
  lessonId?: string;
  /** Lze do lekce zapisovat obsah (jen vlastní lekce učitele). */
  editable?: boolean;
}

const SOURCE_KIND_LABEL: Record<TeacherSourceKind, string> = {
  lesson: "Vlastní lekce",
  catalog: "Lekce z katalogu",
  plan: "Plán hodiny",
  worksheet: "Pracovní list",
};

/** Vytáhne čitelný text z libovolné JSON struktury (slides, spec, blocks…). */
function jsonToText(value: any, depth = 0): string {
  if (value == null || depth > 8) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => jsonToText(v, depth + 1)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([k]) => !/^(id|_id|type|kind|color|theme|url|src|image|font|width|height|x|y|w|h|seed)$/i.test(k))
      .map(([, v]) => jsonToText(v, depth + 1))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}


interface PhaseValue {
  timeMin: string;
  description: string;
  equipment?: string;
  activities?: { kind: string; title: string }[];
}

interface ModelSituation {
  scenario: string;
  task: string;
}

interface Suggestion {
  title: string;
  subject?: string;
  summary: string;
  phases: Record<string, PhaseValue>;
  methodNotes: { method_id: string; note: string }[];
  teacherInstructions?: string;
  modelSituation?: ModelSituation | null;
}

type ThinkingType = "creative" | "logical" | "practical";

const THINKING_LABELS: Record<ThinkingType, string> = {
  creative: "Kreativní uvažování",
  logical: "Logické uvažování",
  practical: "Praktické uplatnění",
};

/** Srozumitelné české popisky druhů aktivit (AI vrací technické konstanty). */
const ACTIVITY_KIND_LABELS: Record<string, string> = {
  quiz: "Kvíz",
  worksheet: "Pracovní list",
  live_game: "Živá hra",
  lesson_block: "Blok v lekci",
  offline_activity: "Aktivita bez počítače",
  discussion: "Diskuze",
};

const activityKindLabel = (kind?: string) => {
  const key = (kind ?? "").trim().toLowerCase();
  if (!key) return "";
  return ACTIVITY_KIND_LABELS[key] ?? key.replace(/_/g, " ");
};

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
      const p = b.props ?? b;
      const parts: string[] = [];
      for (const key of ["title", "text", "content", "question", "prompt", "caption"]) {
        if (typeof p?.[key] === "string" && p[key].trim()) parts.push(p[key].trim());
      }
      for (const key of ["items", "bullets", "options", "answers"]) {
        const arr = p?.[key];
        if (Array.isArray(arr)) {
          const vals = arr
            .map((it: any) =>
              typeof it === "string" ? it : typeof it?.text === "string" ? it.text : "",
            )
            .filter(Boolean);
          if (vals.length) parts.push(vals.map((v: string) => `• ${v}`).join("\n"));
        }
      }
      return parts.join("\n");
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
  const [teacherLessons, setTeacherLessons] = useState<TeacherSource[]>([]);
  const [lessonSubjectFilter, setLessonSubjectFilter] = useState<string>("__all");
  const [lessonSearch, setLessonSearch] = useState("");
  // Předměty bývají uložené jako název („Mediální výchova“) i jako kód („medialni_vychova“) – sjednotíme.
  const subjectKey = (s?: string | null) =>
    s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim() : "";
  const subjectLabels = useMemo(() => {
    const m = new Map<string, string>();
    const score = (s: string) => (s.includes("_") ? 0 : 2) + (/[A-ZÁ-Ž]/.test(s[0]) ? 1 : 0);
    const raw = new Map<string, string>();
    for (const l of teacherLessons) {
      if (!l.subject) continue;
      const k = subjectKey(l.subject);
      const cur = raw.get(k);
      if (!cur || score(l.subject) > score(cur)) raw.set(k, l.subject);
    }
    for (const [k, s] of raw) m.set(k, s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()));
    return m;
  }, [teacherLessons]);
  const lessonSubjects = useMemo(
    () => Array.from(subjectLabels.entries()).sort(([, a], [, b]) => a.localeCompare(b, "cs")),
    [subjectLabels],
  );
  const groupedLessons = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const q = norm(lessonSearch.trim());
    const filtered = teacherLessons.filter((l) => {
      if (lessonSubjectFilter === "__none" && l.subject) return false;
      if (lessonSubjectFilter !== "__all" && lessonSubjectFilter !== "__none" && subjectKey(l.subject) !== lessonSubjectFilter)
        return false;
      if (q && !norm(`${l.title} ${l.source ?? ""}`).includes(q)) return false;
      return true;
    });
    const map = new Map<string, TeacherSource[]>();
    for (const l of filtered) {
      const key = (l.subject && subjectLabels.get(subjectKey(l.subject))) || "Bez předmětu";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    const groups = Array.from(map.entries()).sort(([a], [b]) =>
      a === "Bez předmětu" ? 1 : b === "Bez předmětu" ? -1 : a.localeCompare(b, "cs"),
    );
    return { groups, count: filtered.length };
  }, [teacherLessons, lessonSubjectFilter, lessonSearch, subjectLabels]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState(false);
  const [sourceMode, setSourceMode] = useState<"text" | "lesson" | "file">("text");
  const [sourceText, setSourceText] = useState("");
  const [sourceLessonId, setSourceLessonId] = useState<string>("");

  const [sourceTitle, setSourceTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingWorksheet, setCreatingWorksheet] = useState(false);
  /** Plán hodiny vytvořený z aktuálního návrhu (pro propojení s pracovním listem). */
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);
  const [createdWorksheetId, setCreatedWorksheetId] = useState<string | null>(null);
  const LAST_KEY = "bezli.suggestByMethod.last";
  // Obnoví poslední návrh po návratu z plánu / pracovního listu (kvůli propojení obou).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LAST_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.suggestion) setSuggestion(saved.suggestion);
      if (Array.isArray(saved?.methodIds)) setSelectedMethodIds(saved.methodIds);
      setCreatedPlanId(saved?.planId ?? null);
      setCreatedWorksheetId(saved?.worksheetId ?? null);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (!suggestion) return;
      sessionStorage.setItem(
        LAST_KEY,
        JSON.stringify({ suggestion, methodIds: selectedMethodIds, planId: createdPlanId, worksheetId: createdWorksheetId }),
      );
    } catch {
      /* ignore */
    }
  }, [suggestion, selectedMethodIds, createdPlanId, createdWorksheetId]);
  const [insertingIntoLesson, setInsertingIntoLesson] = useState(false);
  const [insertSlidesOpen, setInsertSlidesOpen] = useState(false);
  const [thinkingTypes, setThinkingTypes] = useState<ThinkingType[]>([]);
  const [curriculumPlan, setCurriculumPlan] = useState<{ subject: string; content: string | null; file_name: string | null } | null>(null);

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
    let cancelled = false;
    (async () => {
      setSourcesLoading(true);
      setSourcesError(false);
      const [lessonsRes, plansRes, worksheetsRes] = await Promise.all([
        loadTeacherLessonOptions(user.id).then(
          (data) => ({ data, error: null as any }),
          (error) => ({ data: [] as Awaited<ReturnType<typeof loadTeacherLessonOptions>>, error }),
        ),
        supabase
          .from("lesson_plans")
          .select("id, title, slides, subject")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("worksheets")
          .select("id, title, spec, subject")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      const errored = [lessonsRes.error, plansRes.error, worksheetsRes.error].filter(Boolean);
      if (errored.length > 0) {
        console.error("Nepodařilo se načíst zdroje učitele", errored);
        setSourcesError(true);
        toast({
          title: "Nepodařilo se načíst lekce, zkuste to prosím znovu",
          variant: "destructive",
        });
      }

      const sources: TeacherSource[] = [
        ...(lessonsRes.data ?? []).map((l) => ({
          id: `lesson:${l.id}`,
          title: l.title || "Bez názvu",
          kind: (l.origin === "own" ? "lesson" : "catalog") as TeacherSourceKind,
          content: l.blocks,
          source: [l.textbookTitle, l.topicTitle].filter(Boolean).join(" · ") || l.source,
          subject: l.subject ?? null,
          lessonId: l.id,
          editable: true,
        })),
        ...((plansRes.data as any[]) ?? []).map((p) => ({
          id: `plan:${p.id}`,
          title: p.title || "Bez názvu",
          kind: "plan" as const,
          subject: p.subject ?? null,
          content: p.slides,
        })),
        ...((worksheetsRes.data as any[]) ?? []).map((w) => ({
          id: `worksheet:${w.id}`,
          title: w.title || "Bez názvu",
          kind: "worksheet" as const,
          subject: w.subject ?? null,
          content: w.spec,
        })),
      ];
      setTeacherLessons(sources);
      setSourcesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);


  useEffect(() => {
    if (!user || !subject.trim()) {
      setCurriculumPlan(null);
      return;
    }
    const s = subject.trim();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("teacher_curriculum_plans")
        .select("subject, content, file_name")
        .eq("teacher_id", user.id)
        .ilike("subject", s)
        .maybeSingle();
      if (!cancelled) setCurriculumPlan((data as any) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subject]);


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

  const selectedSource = useMemo(
    () => teacherLessons.find((x) => x.id === sourceLessonId) ?? null,
    [teacherLessons, sourceLessonId],
  );

  const resolveSourceText = (): { text: string; title: string } => {
    if (sourceMode === "lesson" && selectedSource) {
      const l = selectedSource;
      const raw = (l.content as any)?.blocks ?? l.content ?? [];
      const isLesson = l.kind === "lesson" || l.kind === "catalog";
      const text =
        isLesson && Array.isArray(raw)
          ? blocksToText(raw) || jsonToText(raw)
          : jsonToText(raw);
      return { text: (text || "").slice(0, 20000), title: l.title };
    }
    return { text: sourceText, title: sourceTitle };
  };

  /** Náhled toho, co se pošle do AI (jen pro vybraný vlastní/katalogový materiál). */
  const sourcePreview = useMemo(() => {
    if (sourceMode !== "lesson" || !selectedSource) return null;
    const raw = (selectedSource.content as any)?.blocks ?? selectedSource.content ?? [];
    const isLesson = selectedSource.kind === "lesson" || selectedSource.kind === "catalog";
    const text =
      (isLesson && Array.isArray(raw)
        ? blocksToText(raw) || jsonToText(raw)
        : jsonToText(raw)) || "";
    return {
      title: selectedSource.title,
      kindLabel: SOURCE_KIND_LABEL[selectedSource.kind],
      source: selectedSource.source,
      length: text.length,
      blocks: Array.isArray(raw) ? raw.length : 0,
      excerpt: text.slice(0, 1200),
    };
  }, [sourceMode, selectedSource]);


  const generate = async () => {
    if (selectedMethodIds.length === 0) {
      toast({ title: "Vyberte alespoň jednu metodu.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setSuggestion(null);
    setCreatedPlanId(null);
    setCreatedWorksheetId(null);
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
          thinkingTypes,
          curriculumContext: curriculumPlan?.content ?? "",
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

      const teacherInstructions = [
        suggestion.teacherInstructions?.trim()
          ? `Postup a na co si dát pozor:\n${suggestion.teacherInstructions.trim()}`
          : "",
        methodSummary ? `Pedagogické zdůvodnění metod:\n${methodSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const studentDescription = [
        suggestion.modelSituation?.scenario?.trim() ?? "",
        suggestion.modelSituation?.task?.trim() ? `Úkol: ${suggestion.modelSituation.task.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data, error } = await supabase
        .from("lesson_plans")
        .insert({
          teacher_id: user.id,
          title: suggestion.title || "Návrh podle metody",
          student_description: studentDescription || null,
          teacher_instructions: teacherInstructions || null,
          ...(createdWorksheetId ? { worksheet_ids: [createdWorksheetId] } : {}),
          input_data: {
            description: suggestion.summary || "",
            subject: suggestion.subject || subject,
            phases: phasesForEditor,
            generatedFromMethods: selectedMethodIds,
            aiSource: "suggest-lesson-from-methods",
          } as any,
          ai_generated: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      const planId = (data as any).id as string;
      setCreatedPlanId(planId);
      try {
        sessionStorage.setItem(
          LAST_KEY,
          JSON.stringify({ suggestion, methodIds: selectedMethodIds, planId, worksheetId: createdWorksheetId }),
        );
      } catch {
        /* ignore */
      }

      // Pomůcky ke každé fázi (jen pro učitele).
      const equipment: Record<string, string> = {};
      for (const key of Object.keys(PHASE_LABELS)) {
        const eq = suggestion.phases?.[key]?.equipment?.trim();
        if (eq && !/^(žádné|nic|-|–)\.?$/i.test(eq)) equipment[key] = eq;
      }
      try {
        await savePlanEquipment(planId, user.id, equipment, Object.keys(PHASE_LABELS));
      } catch (eqErr) {
        console.warn("Uložení pomůcek selhalo:", eqErr);
      }

      // Link chosen methods to this lesson plan (best effort; ignore if table shape differs)
      try {
        const links = selectedMethodIds.map((mid) => ({
          method_id: mid,
          lesson_plan_id: planId,
        }));
        await supabase.from("lesson_method_links").insert(links as any);
      } catch (linkErr) {
        console.warn("lesson_method_links insert skipped:", linkErr);
      }

      toast({ title: "Draft plánu hodiny vytvořen." });
      navigate(`/ucitel/plany-hodin/${planId}`);
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

  /** Otevře generátor pracovního listu předvyplněný z návrhu (bez automatického generování). */
  const createWorksheetFromSuggestion = async () => {
    if (!user || !suggestion) return;
    setCreatingWorksheet(true);
    try {
      const topic = suggestion.title || "Návrh podle metody";
      const lines: string[] = [`Téma hodiny: ${topic}`];
      if (suggestion.summary) lines.push(`Shrnutí: ${suggestion.summary}`);
      if (suggestion.modelSituation?.scenario || suggestion.modelSituation?.task) {
        lines.push("", "Modelová situace:");
        if (suggestion.modelSituation.scenario) lines.push(suggestion.modelSituation.scenario);
        if (suggestion.modelSituation.task) lines.push(`Úkol pro žáky: ${suggestion.modelSituation.task}`);
      }
      lines.push("", "Fáze hodiny a aktivity:");
      for (const [key, label] of Object.entries(PHASE_LABELS)) {
        const p = suggestion.phases?.[key];
        if (!p) continue;
        lines.push(`## ${label}${p.timeMin ? ` (${p.timeMin} min)` : ""}`);
        if (p.description) lines.push(p.description);
        for (const a of p.activities ?? []) lines.push(`- ${activityKindLabel(a.kind)}: ${a.title}`);
      }
      const context = lines.join("\n");
      const title = `Pracovní list – ${topic}`;
      const subj = suggestion.subject || subject || "";
      const { data: created, error } = await supabase
        .from("worksheets" as any)
        .insert({
          teacher_id: user.id,
          title,
          spec: emptyWorksheetSpec({ title }) as any,
          ...(subj ? { subject: subj } : {}),
          ai_generated: true,
        } as any)
        .select("id")
        .single();
      if (error || !created) throw error ?? new Error("Nepodařilo se založit pracovní list");
      const wsId = (created as any).id as string;
      setCreatedWorksheetId(wsId);
      try {
        sessionStorage.setItem(
          LAST_KEY,
          JSON.stringify({ suggestion, methodIds: selectedMethodIds, planId: createdPlanId, worksheetId: wsId }),
        );
      } catch {
        /* ignore */
      }
      try {
        sessionStorage.setItem(`bezli.worksheetPrefill:${wsId}`, context);
      } catch {
        /* ignore */
      }
      // Propojení s plánem hodiny vytvořeným ze stejného návrhu.
      if (createdPlanId) {
        const { data: planRow } = await supabase
          .from("lesson_plans")
          .select("worksheet_ids")
          .eq("id", createdPlanId)
          .maybeSingle();
        const ids = Array.from(new Set([...(((planRow as any)?.worksheet_ids ?? []) as string[]), wsId]));
        await supabase.from("lesson_plans").update({ worksheet_ids: ids } as any).eq("id", createdPlanId);
      }
      const params = new URLSearchParams({ topic });
      if (subj) params.set("topic_subject", subj);
      navigate(`/ucitel/pracovni-listy/${wsId}?${params.toString()}`);
    } catch (err: any) {
      toast({
        title: "Nepodařilo se otevřít generátor pracovního listu",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setCreatingWorksheet(false);
    }
  };

  /** Doplní navržené fáze a aktivity jako obsah přímo do vybrané vlastní lekce. */
  const insertIntoLesson = async () => {
    if (!suggestion || !selectedSource?.lessonId || !selectedSource.editable) return;
    setInsertingIntoLesson(true);
    try {
      const lessonId = selectedSource.lessonId;
      const table = selectedSource.kind === "lesson" ? "teacher_textbook_lessons" : "textbook_lessons";
      const linkColumn = selectedSource.kind === "lesson" ? "lesson_id" : "catalog_lesson_id";
      const { data: current, error: readErr } = await supabase
        .from(table as any)
        .select("blocks")
        .eq("id", lessonId)
        .single();
      if (readErr) throw readErr;

      const existing = normalizeBlocks(((current as any)?.blocks ?? []) as Block[]);
      const added: Block[] = [];
      const push = (type: Block["type"], props: Record<string, any>) =>
        added.push({ id: crypto.randomUUID(), type, visible: true, props });

      push("divider", { style: "line" });
      push("heading", { level: 2, text: `Návrh podle metody: ${suggestion.title}` });
      if (suggestion.summary) push("paragraph", { text: suggestion.summary });

      for (const [key, label] of Object.entries(PHASE_LABELS)) {
        const p = suggestion.phases?.[key];
        if (!p || (!p.description && !(p.activities ?? []).length)) continue;
        push("heading", { level: 3, text: p.timeMin ? `${label} (${p.timeMin} min)` : label });
        if (p.description) push("paragraph", { text: p.description });
        const items = (p.activities ?? [])
          .map((a) => [activityKindLabel(a.kind), a.title].filter(Boolean).join(": "))
          .filter(Boolean);
        if (items.length) push("bullet_list", { items });
      }

      if (suggestion.modelSituation?.scenario || suggestion.modelSituation?.task) {
        push("callout", {
          calloutType: "note",
          text: [suggestion.modelSituation?.scenario, suggestion.modelSituation?.task]
            .filter(Boolean)
            .join("\n\n"),
        });
      }

      if (added.length <= 2) {
        throw new Error("Návrh neobsahuje žádný obsah k vložení.");
      }

      const { error: updErr } = await supabase
        .from(table as any)
        .update({ blocks: [...existing, ...added] as any })
        .eq("id", lessonId);
      if (updErr) throw updErr;

      // Propojení metod přímo s lekcí (duplicity ignorujeme).
      for (const mid of selectedMethodIds) {
        const { error } = await supabase
          .from("lesson_method_links")
          .insert({
            [linkColumn]: lessonId,
            method_id: mid,
            ...(linkColumn === "catalog_lesson_id" ? { created_by: user?.id } : {}),
          } as any);
        if (error && !/duplicate|unique/i.test(error.message)) {
          console.warn("lesson_method_links insert skipped:", error);
        }
      }

      toast({
        title: "Aktivity vloženy do lekce",
        description: `Do lekce „${selectedSource.title}" bylo přidáno ${added.length} bloků obsahu.`,
      });
    } catch (err: any) {
      toast({
        title: "Nepodařilo se vložit obsah do lekce",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setInsertingIntoLesson(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pt-24 pb-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold">Návrh lekce podle metody</h1>
              <p className="text-xs font-medium text-primary mt-0.5 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> S asistentem Bezlai
              </p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Nahrajte materiál nebo vyberte lekci, zvolte jednu či více výukových metod a Bezlai navrhne, jak lekci pojmout — včetně konkrétních procvičovacích aktivit.
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
                Vybrat lekci
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
                <Label>Materiál (vlastní lekce, lekce z katalogu, plán hodiny, pracovní list)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-2">
                  <Select value={lessonSubjectFilter} onValueChange={setLessonSubjectFilter}>
                    <SelectTrigger aria-label="Filtr předmětu">
                      <SelectValue placeholder="Všechny předměty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Všechny předměty</SelectItem>
                      {lessonSubjects.map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                      <SelectItem value="__none">Bez předmětu</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="search"
                    aria-label="Hledat lekci"
                    value={lessonSearch}
                    onChange={(e) => setLessonSearch(e.target.value)}
                    placeholder="Hledat podle názvu lekce, učebnice nebo tématu…"
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Nalezeno {groupedLessons.count} z {teacherLessons.length} materiálů
                </p>
                <Select value={sourceLessonId} onValueChange={setSourceLessonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte materiál…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {sourcePreview && !groupedLessons.groups.some(([, ls]) => ls.some((l) => l.id === sourceLessonId)) && (
                      <SelectItem value={sourceLessonId} className="hidden">{sourcePreview.title}</SelectItem>
                    )}
                    {groupedLessons.groups.map(([subject, ls]) => (
                      <SelectGroup key={subject}>
                        <SelectLabel className="text-primary">{subject} ({ls.length})</SelectLabel>
                        {ls.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {SOURCE_KIND_LABEL[l.kind]}: {l.title}
                            {l.source ? ` · ${l.source}` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {teacherLessons.length > 0 && groupedLessons.count === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">Žádný materiál neodpovídá filtru.</div>
                    )}
                    {teacherLessons.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">
                        {sourcesLoading
                          ? "Načítám…"
                          : sourcesError
                            ? "Nepodařilo se načíst lekce, zkuste to prosím znovu."
                            : "Zatím nemáte žádné vlastní materiály."}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {sourcesError && (
                  <p className="text-xs text-destructive mt-1">
                    Nepodařilo se načíst lekce, zkuste to prosím znovu.
                  </p>
                )}

                {sourcePreview && (
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium">{sourcePreview.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {sourcePreview.kindLabel}
                      </Badge>
                      {sourcePreview.source && (
                        <span className="text-xs text-muted-foreground">{sourcePreview.source}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Náhled obsahu, který se pošle asistentovi: {sourcePreview.blocks} bloků,{" "}
                      {sourcePreview.length} znaků.
                    </p>
                    {sourcePreview.excerpt ? (
                      <pre className="text-xs whitespace-pre-wrap max-h-52 overflow-auto text-foreground/80">
                        {sourcePreview.excerpt}
                        {sourcePreview.length > sourcePreview.excerpt.length ? "\n…" : ""}
                      </pre>
                    ) : (
                      <p className="text-xs text-destructive">
                        Tento materiál neobsahuje žádný text – asistent navrhne obecnou strukturu podle metod.
                      </p>
                    )}
                  </div>
                )}
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
                          <span
                            className="inline-flex"
                            onClick={(e) => {
                              // Až po otevření popoveru zabráníme přepnutí checkboxu v <label>.
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                          <Popover>
                            <PopoverTrigger asChild>
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
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{m.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">Katalog metod se načítá…</p>
              )}
            </div>

            <div className="mt-5 rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="text-sm font-semibold">Zaměření myšlení a modelová situace (nepovinné)</div>
              <p className="text-xs text-muted-foreground">
                Bezlai zahrne do návrhu aktivity či otázky rozvíjející vybrané typy uvažování a přidá modelovou situaci z praxe.
              </p>
              <div className="flex flex-wrap gap-4 pt-1">
                {(Object.keys(THINKING_LABELS) as ThinkingType[]).map((tt) => {
                  const active = thinkingTypes.includes(tt);
                  return (
                    <label key={tt} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={active}
                        onCheckedChange={() =>
                          setThinkingTypes((prev) =>
                            prev.includes(tt) ? prev.filter((x) => x !== tt) : [...prev, tt],
                          )
                        }
                      />
                      {THINKING_LABELS[tt]}
                    </label>
                  );
                })}
              </div>
            </div>

            {curriculumPlan && (curriculumPlan.content || curriculumPlan.file_name) && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
                <FileText className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <div className="font-medium">
                    Použije se váš ŠVP pro předmět „{curriculumPlan.subject}" jako kontext.
                  </div>
                  {!curriculumPlan.content && curriculumPlan.file_name && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Poznámka: máte uložený jen soubor ({curriculumPlan.file_name}). Bezlai zpracuje pouze textový obsah ŠVP – doplňte prosím text, pokud jej chcete použít.
                    </div>
                  )}
                </div>
              </div>
            )}

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
              {suggestion.modelSituation && (suggestion.modelSituation.scenario || suggestion.modelSituation.task) && (
                <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Modelová situace</h3>
                    <Badge variant="secondary" className="text-xs">Bezlai</Badge>
                  </div>
                  {suggestion.modelSituation.scenario && (
                    <p className="text-sm mb-2 whitespace-pre-line">{suggestion.modelSituation.scenario}</p>
                  )}
                  {suggestion.modelSituation.task && (
                    <div className="text-sm">
                      <span className="font-medium">Úkol / otázka: </span>
                      <span className="whitespace-pre-line">{suggestion.modelSituation.task}</span>
                    </div>
                  )}
                </div>
              )}
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
                      {p.equipment && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <strong>Pomůcky:</strong> {p.equipment}
                        </p>
                      )}
                      {p.activities && p.activities.length > 0 && (
                        <ul className="text-sm space-y-1">
                          {p.activities.map((a, i) => (
                             <li key={i} className="flex gap-2">
                               <span className="text-primary">•</span>
                               <span className="flex flex-wrap items-center gap-2">
                                 {a.kind && (
                                   <Badge variant="secondary" className="text-[11px] font-medium">
                                     {activityKindLabel(a.kind)}
                                   </Badge>
                                 )}
                                 <span>{a.title}</span>
                               </span>
                             </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {suggestion.teacherInstructions && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <h3 className="font-semibold mb-2">Instrukce pro učitele</h3>
                  <p className="text-sm whitespace-pre-line">{suggestion.teacherInstructions}</p>
                </div>
              )}

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

              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                <Button variant="outline" className="gap-2" onClick={() => setInsertSlidesOpen(true)}>
                  <MonitorPlay className="w-4 h-4" />
                  Vložit fáze jako slidy
                </Button>
                {selectedSource?.editable && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={insertIntoLesson}
                    disabled={insertingIntoLesson}
                  >
                    {insertingIntoLesson ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BookOpen className="w-4 h-4" />
                    )}
                    Vložit navržené aktivity do lekce „{selectedSource.title}"
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={createWorksheetFromSuggestion}
                  disabled={creatingWorksheet}
                >
                  {creatingWorksheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Vytvořit pracovní list z návrhu
                </Button>
                <Button onClick={createDraft} disabled={creating} className="gap-2">
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Vytvořit plán hodiny z tohoto návrhu
                </Button>
              </div>

              <InsertSlidesIntoPresentationDialog
                open={insertSlidesOpen}
                onOpenChange={setInsertSlidesOpen}
                slides={phasesToSlides(suggestion.phases || {}, PHASE_LABELS, suggestion.title)}
                description="Z každé fáze a aktivity vznikne textový slide. U aktivit pak můžete v editoru prezentace použít „Dogenerovat aktivitu“."
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
