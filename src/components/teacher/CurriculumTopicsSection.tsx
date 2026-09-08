import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Check,
  X,
  Pencil,
  Link2,
  BookOpen,
  FileText,
} from "lucide-react";
import AiContentBadge from "@/components/ai/AiContentBadge";
import type { Block } from "@/lib/textbook-config";
import { curriculumBlocksToText } from "@/lib/curriculum-template";
import { extractTopicsFromBlocks } from "@/lib/curriculum-topics";
import { CURRICULUM_AI_MAX_CHARS, extractDocumentText } from "@/lib/curriculum-file-extract";

interface LinkedItem {
  kind: "lesson" | "lesson_plan";
  id: string;
  title: string;
  /** Název učebnice (u lekce). */
  parent?: string;
}

interface CurriculumTopic {
  id: string;
  title: string;
  sort_order: number;
  linked: LinkedItem[];
  ai_generated?: boolean;
  ai_modified_at?: string | null;
}

interface Candidate {
  kind: "lesson" | "lesson_plan";
  id: string;
  title: string;
  parent?: string;
}

interface Props {
  planId: string;
  planContent: string | null;
  planBlocks?: Block[];
  fileUrl?: string | null;
  fileName?: string | null;
  teacherId: string;
  subject: string;
}

export default function CurriculumTopicsSection({
  planId,
  planContent,
  planBlocks,
  fileUrl,
  fileName,
  teacherId,
  subject,
}: Props) {
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStep, setAiStep] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Párování
  const [pairTopic, setPairTopic] = useState<CurriculumTopic | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pairQuery, setPairQuery] = useState("");
  const [pairSelected, setPairSelected] = useState<Set<string>>(new Set());
  const [pairSaving, setPairSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const hasBlocks = Array.isArray(planBlocks) && planBlocks.length > 0;
  const hasText = !!planContent?.trim();
  const hasFile = !!fileUrl;
  const canExtract = hasBlocks || hasText || hasFile;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: t } = await supabase
      .from("curriculum_topics")
      .select("id, title, sort_order, ai_generated, ai_modified_at")
      .eq("curriculum_plan_id", planId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const topicRows =
      (t as {
        id: string;
        title: string;
        sort_order: number;
        ai_generated?: boolean;
        ai_modified_at?: string | null;
      }[] | null) ?? [];
    const ids = topicRows.map((r) => r.id);

    const linkedByTopic: Record<string, LinkedItem[]> = {};
    if (ids.length > 0) {
      const [{ data: cov }, { data: pcov }] = await Promise.all([
        supabase
          .from("lesson_curriculum_coverage")
          .select("curriculum_topic_id, lesson_id")
          .in("curriculum_topic_id", ids),
        supabase
          .from("lesson_plan_curriculum_coverage")
          .select("curriculum_topic_id, lesson_plan_id")
          .in("curriculum_topic_id", ids),
      ]);
      const covRows = (cov as { curriculum_topic_id: string; lesson_id: string }[] | null) ?? [];
      const pcovRows =
        (pcov as { curriculum_topic_id: string; lesson_plan_id: string }[] | null) ?? [];

      const lessonIds = Array.from(new Set(covRows.map((r) => r.lesson_id)));
      const planIds = Array.from(new Set(pcovRows.map((r) => r.lesson_plan_id)));

      const [lessonsRes, plansRes] = await Promise.all([
        lessonIds.length
          ? supabase
              .from("teacher_textbook_lessons")
              .select("id, title, textbook_id, teacher_textbooks(title)")
              .in("id", lessonIds)
          : Promise.resolve({ data: [] as unknown[] }),
        planIds.length
          ? supabase.from("lesson_plans").select("id, title").in("id", planIds)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);
      const lessonMap = new Map<string, { title: string; parent?: string }>();
      for (const l of (lessonsRes.data as
        | { id: string; title: string; teacher_textbooks?: { title: string } | null }[]
        | null) ?? []) {
        lessonMap.set(l.id, { title: l.title, parent: l.teacher_textbooks?.title });
      }
      const planMap = new Map<string, string>();
      for (const p of (plansRes.data as { id: string; title: string }[] | null) ?? []) {
        planMap.set(p.id, p.title);
      }

      for (const r of covRows) {
        const info = lessonMap.get(r.lesson_id);
        (linkedByTopic[r.curriculum_topic_id] ??= []).push({
          kind: "lesson",
          id: r.lesson_id,
          title: info?.title ?? "Lekce",
          parent: info?.parent,
        });
      }
      for (const r of pcovRows) {
        (linkedByTopic[r.curriculum_topic_id] ??= []).push({
          kind: "lesson_plan",
          id: r.lesson_plan_id,
          title: planMap.get(r.lesson_plan_id) ?? "Plán hodiny",
        });
      }
    }

    setTopics(topicRows.map((r) => ({ ...r, linked: linkedByTopic[r.id] ?? [] })));
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = topics.length;
    const covered = topics.filter((t) => t.linked.length > 0).length;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
    return { total, covered, pct };
  }, [topics]);

  /** Uloží nová témata (bez duplicit vůči existujícím). */
  const insertTopics = async (list: string[], aiGenerated: boolean) => {
    const existing = new Set(topics.map((t) => t.title.trim().toLowerCase()));
    const seen = new Set<string>();
    const toInsert: string[] = [];
    for (const raw of list) {
      const title = raw.trim();
      const k = title.toLowerCase();
      if (!title || existing.has(k) || seen.has(k)) continue;
      seen.add(k);
      toInsert.push(title);
    }
    if (toInsert.length === 0) {
      toast({ title: "Všechna nalezená témata už máte v seznamu." });
      return 0;
    }
    const startOrder = topics.length;
    const { error } = await supabase.from("curriculum_topics").insert(
      toInsert.map((title, i) => ({
        curriculum_plan_id: planId,
        title,
        sort_order: startOrder + i,
        ai_generated: aiGenerated,
      })),
    );
    if (error) throw error;
    return toInsert.length;
  };

  const aiTopicsFromText = async (text: string): Promise<string[]> => {
    const { data, error } = await supabase.functions.invoke("parse-curriculum-topics", {
      body: { curriculumText: text.slice(0, CURRICULUM_AI_MAX_CHARS) },
    });
    if (error) throw error;
    return Array.isArray(data?.topics) ? (data.topics as string[]) : [];
  };

  /** Stáhne nahraný soubor ŠVP a vytáhne z něj text (PDF lokálně, ostatní přes edge funkci). */
  const textFromFile = async (): Promise<string> => {
    if (!fileUrl) return "";
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error("Nahraný soubor ŠVP se nepodařilo stáhnout.");
    const blob = await res.blob();
    const name = fileName || "svp.pdf";
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    return extractDocumentText(file);
  };

  /**
   * Vytáhnout témata z ŠVP:
   * 1) z bloků – přímo ze struktury (nadpisy, tabulka Učivo); když nic nenajde, AI nad textem bloků,
   * 2) z vloženého textu – AI,
   * 3) z nahraného souboru – extrahovaný text → AI.
   */
  const extractTopics = async () => {
    if (!canExtract) {
      toast({
        title: "ŠVP nemá obsah",
        description: "Doplňte bloky, text nebo nahrajte soubor ŠVP.",
        variant: "destructive",
      });
      return;
    }
    setAiBusy(true);
    try {
      let list: string[] = [];
      let aiGenerated = false;
      let source = "";

      if (hasBlocks) {
        setAiStep("Čtu strukturu bloků…");
        list = extractTopicsFromBlocks(planBlocks!);
        source = "ze struktury bloků";
        if (list.length === 0) {
          const text = curriculumBlocksToText(planBlocks!);
          if (text.trim()) {
            setAiStep("AI rozpoznává témata z textu bloků…");
            list = await aiTopicsFromText(text);
            aiGenerated = true;
            source = "pomocí AI z textu bloků";
          }
        }
      }

      if (list.length === 0 && hasText) {
        setAiStep("AI rozpoznává témata z textu ŠVP…");
        list = await aiTopicsFromText(planContent!);
        aiGenerated = true;
        source = "pomocí AI z textu ŠVP";
      }

      if (list.length === 0 && hasFile) {
        setAiStep("Načítám text z nahraného souboru…");
        const text = await textFromFile();
        if (!text.trim()) throw new Error("Z nahraného souboru se nepodařilo získat text.");
        setAiStep("AI rozpoznává témata ze souboru…");
        list = await aiTopicsFromText(text);
        aiGenerated = true;
        source = "pomocí AI z nahraného souboru";
      }

      if (list.length === 0) {
        toast({ title: "Žádná témata nenalezena", description: "Zkuste téma přidat ručně." });
        return;
      }
      const n = await insertTopics(list, aiGenerated);
      if (n > 0) {
        toast({
          title: `Přidáno ${n} témat (${source})`,
          description: "Můžete je ještě upravit, smazat nebo napárovat.",
        });
        load();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Vytažení témat se nepovedlo", description: msg, variant: "destructive" });
    } finally {
      setAiBusy(false);
      setAiStep("");
    }
  };

  const addManual = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("curriculum_topics").insert({
        curriculum_plan_id: planId,
        title,
        sort_order: topics.length,
      });
      if (error) throw error;
      setNewTitle("");
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (t: CurriculumTopic) => {
    setEditingId(t.id);
    setEditTitle(t.title);
  };

  const saveEdit = async (id: string) => {
    const title = editTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    const { error } = await supabase.from("curriculum_topics").update({ title }).eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    load();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Smazat toto téma? Zruší se i vazby na lekce a plány hodin.")) return;
    const { error } = await supabase.from("curriculum_topics").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  // ─────────────── Párování lekcí a plánů hodin ───────────────

  const loadCandidates = useCallback(async () => {
    const [{ data: lessons }, { data: plans }] = await Promise.all([
      supabase
        .from("teacher_textbook_lessons")
        .select("id, title, textbook_id, teacher_textbooks!inner(title, teacher_id, deleted_at)")
        .eq("teacher_textbooks.teacher_id", teacherId)
        .is("teacher_textbooks.deleted_at", null)
        .order("title", { ascending: true })
        .limit(1000),
      supabase
        .from("lesson_plans")
        .select("id, title, subject")
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(1000),
    ]);
    const out: Candidate[] = [];
    for (const l of (lessons as
      | { id: string; title: string; teacher_textbooks?: { title: string } | null }[]
      | null) ?? []) {
      out.push({ kind: "lesson", id: l.id, title: l.title, parent: l.teacher_textbooks?.title });
    }
    for (const p of (plans as { id: string; title: string; subject: string }[] | null) ?? []) {
      out.push({ kind: "lesson_plan", id: p.id, title: p.title, parent: p.subject || undefined });
    }
    setCandidates(out);
  }, [teacherId]);

  const openPair = (t: CurriculumTopic) => {
    setPairTopic(t);
    setPairQuery("");
    setPairSelected(new Set(t.linked.map((l) => `${l.kind}:${l.id}`)));
    if (!candidates) loadCandidates();
  };

  const pairFiltered = useMemo(() => {
    if (!candidates) return [];
    const q = pairQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.parent ?? "").toLowerCase().includes(q),
    );
  }, [candidates, pairQuery]);

  const togglePair = (key: string) =>
    setPairSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const savePairs = async () => {
    if (!pairTopic) return;
    setPairSaving(true);
    try {
      const before = new Set(pairTopic.linked.map((l) => `${l.kind}:${l.id}`));
      const toAdd = Array.from(pairSelected).filter((k) => !before.has(k));
      const toRemove = Array.from(before).filter((k) => !pairSelected.has(k));

      const addLessons = toAdd.filter((k) => k.startsWith("lesson:")).map((k) => k.slice(7));
      const addPlans = toAdd.filter((k) => k.startsWith("lesson_plan:")).map((k) => k.slice(12));
      const rmLessons = toRemove.filter((k) => k.startsWith("lesson:")).map((k) => k.slice(7));
      const rmPlans = toRemove.filter((k) => k.startsWith("lesson_plan:")).map((k) => k.slice(12));

      if (addLessons.length) {
        const { error } = await supabase
          .from("lesson_curriculum_coverage")
          .insert(addLessons.map((id) => ({ lesson_id: id, curriculum_topic_id: pairTopic.id })));
        if (error) throw error;
      }
      if (addPlans.length) {
        const { error } = await supabase
          .from("lesson_plan_curriculum_coverage")
          .insert(addPlans.map((id) => ({ lesson_plan_id: id, curriculum_topic_id: pairTopic.id })));
        if (error) throw error;
      }
      if (rmLessons.length) {
        const { error } = await supabase
          .from("lesson_curriculum_coverage")
          .delete()
          .eq("curriculum_topic_id", pairTopic.id)
          .in("lesson_id", rmLessons);
        if (error) throw error;
      }
      if (rmPlans.length) {
        const { error } = await supabase
          .from("lesson_plan_curriculum_coverage")
          .delete()
          .eq("curriculum_topic_id", pairTopic.id)
          .in("lesson_plan_id", rmPlans);
        if (error) throw error;
      }
      toast({ title: "Párování uloženo" });
      setPairTopic(null);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Párování se nepodařilo uložit", description: msg, variant: "destructive" });
    } finally {
      setPairSaving(false);
    }
  };

  const removeLink = async (topicId: string, item: LinkedItem) => {
    const key = `${topicId}:${item.kind}:${item.id}`;
    setRemoving(key);
    try {
      const q =
        item.kind === "lesson"
          ? supabase
              .from("lesson_curriculum_coverage")
              .delete()
              .eq("curriculum_topic_id", topicId)
              .eq("lesson_id", item.id)
          : supabase
              .from("lesson_plan_curriculum_coverage")
              .delete()
              .eq("curriculum_topic_id", topicId)
              .eq("lesson_plan_id", item.id);
      const { error } = await q;
      if (error) throw error;
      setTopics((prev) =>
        prev.map((t) =>
          t.id === topicId
            ? { ...t, linked: t.linked.filter((l) => !(l.kind === item.kind && l.id === item.id)) }
            : t,
        ),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold">Témata ŠVP</h4>
        {canExtract && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8"
            onClick={extractTopics}
            disabled={aiBusy}
            title={
              hasBlocks
                ? "Témata se vytáhnou z nadpisů a tabulek bloků ŠVP"
                : hasText
                  ? "Témata rozpozná AI z textu ŠVP"
                  : "Témata rozpozná AI z nahraného souboru"
            }
          >
            {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiBusy && aiStep ? aiStep : "Vytáhnout témata z ŠVP"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Načítání témat…
        </div>
      ) : (
        <>
          {topics.length > 0 && (
            <ul className="space-y-1.5">
              {topics.map((t) => {
                const covered = t.linked.length > 0;
                return (
                  <li key={t.id} className="text-sm bg-muted/30 rounded-md px-2 py-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      {editingId === t.id ? (
                        <>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(t.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(t.id)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 truncate">{t.title}</span>
                          <AiContentBadge aiGenerated={t.ai_generated} aiModifiedAt={t.ai_modified_at} />
                          {covered ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0"
                            >
                              Pokryto ({t.linked.length})
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0"
                            >
                              Chybí
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => openPair(t)}
                            aria-label={`Napárovat lekce a plány k tématu ${t.title}`}
                          >
                            <Link2 className="w-3.5 h-3.5" /> Napárovat
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(t)}
                            aria-label="Upravit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteTopic(t.id)}
                            aria-label="Smazat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    {t.linked.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-0.5">
                        {t.linked.map((l) => {
                          const key = `${t.id}:${l.kind}:${l.id}`;
                          return (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="gap-1 pl-1.5 pr-1 py-0 text-[11px] font-normal"
                              title={`${l.kind === "lesson" ? "Lekce" : "Plán hodiny"}: ${l.title}${l.parent ? ` (${l.parent})` : ""}`}
                            >
                              {l.kind === "lesson" ? (
                                <BookOpen className="w-3 h-3 shrink-0" />
                              ) : (
                                <FileText className="w-3 h-3 shrink-0" />
                              )}
                              <span className="max-w-[200px] truncate">
                                {l.title}
                                {l.parent && <span className="text-muted-foreground"> · {l.parent}</span>}
                              </span>
                              <button
                                type="button"
                                className="hover:text-destructive rounded-sm"
                                onClick={() => removeLink(t.id, l)}
                                disabled={removing === key}
                                aria-label={`Odebrat ${l.title}`}
                              >
                                {removing === key ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addManual();
              }}
              placeholder="Přidat téma ručně…"
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={addManual}
              disabled={adding || !newTitle.trim()}
            >
              <Plus className="w-3.5 h-3.5" /> Přidat
            </Button>
          </div>

          {topics.length > 0 && (
            <div className="rounded-md bg-muted/40 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pokrytí ŠVP lekcemi a plány hodin</span>
                <span className="font-semibold">
                  {stats.covered} / {stats.total} ({stats.pct} %)
                </span>
              </div>
              <Progress value={stats.pct} className="h-1.5" />
            </div>
          )}
        </>
      )}

      <Dialog open={!!pairTopic} onOpenChange={(o) => !o && setPairTopic(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Napárovat k tématu</DialogTitle>
            <DialogDescription className="truncate">
              {pairTopic?.title} · {subject}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={pairQuery}
            onChange={(e) => setPairQuery(e.target.value)}
            placeholder="Hledat lekci nebo plán hodiny…"
            className="h-9"
            autoFocus
          />
          <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
            {!candidates ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Načítání lekcí a plánů…
              </div>
            ) : (
              (["lesson_plan", "lesson"] as const).map((kind) => {
                const items = pairFiltered.filter((c) => c.kind === kind);
                return (
                  <div key={kind} className="space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-1">
                      {kind === "lesson_plan" ? "Plány hodin" : "Lekce učebnic"} ({items.length})
                    </p>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-1">
                        {kind === "lesson_plan" ? "Žádný plán hodiny." : "Žádná lekce."}
                      </p>
                    ) : (
                      items.map((c) => {
                        const key = `${c.kind}:${c.id}`;
                        const sel = pairSelected.has(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            role="checkbox"
                            aria-checked={sel}
                            onClick={() => togglePair(key)}
                            className="w-full flex items-center gap-2 text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                sel ? "bg-primary border-primary text-primary-foreground" : "border-border"
                              }`}
                            >
                              {sel && <Check className="w-3 h-3" />}
                            </span>
                            {c.kind === "lesson" ? (
                              <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1 min-w-0">
                              <span className="block truncate">{c.title}</span>
                              {c.parent && (
                                <span className="block text-[11px] text-muted-foreground truncate">
                                  {c.parent}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPairTopic(null)} disabled={pairSaving}>
              Zrušit
            </Button>
            <Button onClick={savePairs} disabled={pairSaving || !candidates}>
              {pairSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Uložit ({pairSelected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
