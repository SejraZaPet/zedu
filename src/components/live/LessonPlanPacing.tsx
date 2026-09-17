import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Časování a poznámky podle plánu hodiny – POUZE pro ovládací zobrazení učitele.
 * Na projektoru se nikdy nezobrazuje.
 */

const PHASES: { key: string; title: string }[] = [
  { key: "uvod", title: "Úvod" },
  { key: "motivace", title: "Motivace" },
  { key: "hlavni", title: "Hlavní část" },
  { key: "procviceni", title: "Procvičení" },
  { key: "reflexe", title: "Reflexe" },
  { key: "zaver", title: "Závěr" },
];

interface PhaseInfo {
  key: string;
  title: string;
  minutes: number;
  description: string;
}

interface Props {
  teacherId?: string | null;
  sessionTitle?: string | null;
  currentIndex: number;
  slideCount: number;
}

const LessonPlanPacing = ({ teacherId, sessionTitle, currentIndex, slideCount }: Props) => {
  const [phases, setPhases] = useState<PhaseInfo[] | null>(null);
  const [planTitle, setPlanTitle] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());
  const [phaseStartedAt, setPhaseStartedAt] = useState<number>(() => Date.now());

  // Načtení plánu hodiny propojeného s lekcí, ze které prezentace vznikla.
  useEffect(() => {
    if (!teacherId || !sessionTitle) return;
    let cancelled = false;

    (async () => {
      // Lekce se stejným názvem jako prezentace (prezentace se zakládá z lekce).
      const [teacherLessons, globalLessons] = await Promise.all([
        supabase.from("teacher_textbook_lessons").select("id").eq("title", sessionTitle).limit(5),
        supabase.from("textbook_lessons").select("id").eq("title", sessionTitle).limit(5),
      ]);
      const lessonIds = [
        ...((teacherLessons.data as any[]) || []),
        ...((globalLessons.data as any[]) || []),
      ].map((l) => l.id as string);

      const { data } = await supabase
        .from("lesson_plans")
        .select("id, title, input_data")
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (cancelled) return;

      const plans = (data as any[]) || [];
      const plan =
        plans.find((p) => lessonIds.includes(String(p.input_data?.lessonId || ""))) ||
        plans.find((p) => String(p.title || "").trim() === String(sessionTitle).trim());
      if (!plan) return;

      const raw = (plan.input_data?.phases || {}) as Record<string, any>;
      const list: PhaseInfo[] = PHASES.map((p) => ({
        key: p.key,
        title: p.title,
        minutes: parseInt(String(raw[p.key]?.timeMin ?? ""), 10) || 0,
        description: String(raw[p.key]?.description || "").trim(),
      })).filter((p) => p.minutes > 0 || p.description);

      if (list.length === 0) return;
      setPlanTitle(String(plan.title || ""));
      setPhases(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [teacherId, sessionTitle]);

  // Mapování fází na rozsahy snímků podle pořadí a časové dotace (best-effort).
  const mapping = useMemo(() => {
    if (!phases || slideCount <= 0) return null;
    const totalWeight = phases.reduce((s, p) => s + (p.minutes > 0 ? p.minutes : 1), 0);
    let consumed = 0;
    return phases.map((p, i) => {
      const weight = p.minutes > 0 ? p.minutes : 1;
      const start = consumed;
      const span = i === phases.length - 1
        ? slideCount - start
        : Math.max(1, Math.round((weight / totalWeight) * slideCount));
      consumed = Math.min(slideCount, start + span);
      return { ...p, from: start, to: Math.max(start, consumed - 1) };
    });
  }, [phases, slideCount]);

  const activePhase = useMemo(() => {
    if (!mapping) return null;
    return mapping.find((p) => currentIndex >= p.from && currentIndex <= p.to) ?? mapping[mapping.length - 1];
  }, [mapping, currentIndex]);

  // Odpočet fáze začíná ve chvíli, kdy učitel do dané fáze vstoupí.
  useEffect(() => {
    setPhaseStartedAt(Date.now());
  }, [activePhase?.key]);

  useEffect(() => {
    if (!phases) return;
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, [phases]);

  if (!phases || !mapping || !activePhase) return null;

  const elapsedMin = Math.floor((now - phaseStartedAt) / 60000);
  const remaining = activePhase.minutes > 0 ? activePhase.minutes - elapsedMin : null;
  const overtime = remaining !== null && remaining < 0;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /> PLÁN HODINY
          {planTitle && <span className="normal-case font-normal">· {planTitle}</span>}
        </div>
        <Badge variant={overtime ? "destructive" : "secondary"}>
          {activePhase.title}
          {remaining === null
            ? ""
            : overtime
              ? ` · přetahuješ o ${Math.abs(remaining)} min`
              : ` · zbývá ${remaining} min`}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {mapping.map((p) => (
          <span
            key={p.key}
            className={`rounded px-2 py-0.5 text-[11px] ${
              p.key === activePhase.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {p.title}
            {p.minutes > 0 ? ` ${p.minutes}′` : ""} · {p.from + 1}–{p.to + 1}
          </span>
        ))}
      </div>

      {activePhase.description && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Poznámky k výkladu
            </span>
            <ChevronDown className="w-3.5 h-3.5" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{activePhase.description}</p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default LessonPlanPacing;
