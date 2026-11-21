import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Brain, CheckCircle2, FileUp, Flag, Flame, Gamepad2, Layers, ListChecks, Map, MessageCircleQuestion, Route, Sparkles, Star, TimerReset, Trophy } from "lucide-react";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";
import BezlaiTutorChat from "@/components/BezlaiTutorChat";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import {
  examDayLabel,
  examPreparationMinutes,
  loadStudentLearningOverview,
  pickExamPreparationTopic,
  readStoredLearningSubject,
  resolveLearningSubject,
  storeLearningSubject,
  type StudentLearningOverview,
} from "@/lib/student-learning-overview";
import { useStudentPracticeLessons } from "@/hooks/useStudentPracticeLessons";
import { czechDays } from "@/lib/student-dashboard-summary";
import { pickStudyMethod, type StudyMethodLite } from "@/lib/lesson-study";
import StudyLessonActionDialog, { type StudyLessonAction } from "@/components/student/StudyLessonActionDialog";

interface StudentLearningHomeProps {
  userId: string;
  methods: StudyMethodLite[];
  preferredIds: string[];
  onPractice: (method: StudyMethodLite, lessonId: string | null, minutes: number) => void;
}

type ModeId = "cards" | "quiz" | "exam" | "material" | "summary" | "path" | "chat" | "tricks";

const MODES: Array<{ id: ModeId; title: string; detail: string; icon: typeof Brain; tone: string }> = [
  { id: "cards", title: "Chci si to zapamatovat", detail: "Kartičky", icon: Layers, tone: "learn" },
  { id: "quiz", title: "Vyzkoušej se z toho", detail: "Rychlý kvíz", icon: Gamepad2, tone: "assignments" },
  { id: "exam", title: "Blíží se test", detail: "Příprava na test", icon: Flag, tone: "exam" },
  { id: "material", title: "Můj materiál", detail: "Vlastní text nebo soubor", icon: FileUp, tone: "textbooks" },
  { id: "summary", title: "Shrnutí", detail: "To nejdůležitější z lekce", icon: ListChecks, tone: "portfolio" },
  { id: "path", title: "Cesta po tématech", detail: "Podívej se, co už umíš", icon: Route, tone: "notebook" },
  { id: "chat", title: "Zeptej se Zedíka", detail: "Nasměruje tě k odpovědi", icon: MessageCircleQuestion, tone: "studio" },
  { id: "tricks", title: "Triky na učení", detail: "Techniky lidsky vysvětlené", icon: Brain, tone: "subjects" },
];

const PATH_PAGE_SIZE = 8;

function missionStateLabel(state: "done" | "now" | "bonus"): string {
  return state === "done" ? "Hotovo" : state === "now" ? "Právě teď" : "Bonus";
}

export default function StudentLearningHome({ userId, methods, preferredIds, onPractice }: StudentLearningHomeProps) {
  const [overview, setOverview] = useState<StudentLearningOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [studyAction, setStudyAction] = useState<StudyLessonAction | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(() => readStoredLearningSubject(userId));
  const [pathVisibleCount, setPathVisibleCount] = useState(PATH_PAGE_SIZE);
  const [otherLessonId, setOtherLessonId] = useState("");
  const pathRef = useRef<HTMLElement>(null);
  const subjectSwitchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: cachedLessonGroups, isPending: lessonsPending, isError: lessonsError } = useStudentPracticeLessons(userId);

  useEffect(() => {
    setSelectedSubject(readStoredLearningSubject(userId));
  }, [userId]);

  useEffect(() => {
    if (lessonsPending) {
      setLoading(true);
      return;
    }
    if (lessonsError) {
      setOverview(null);
      setLoading(false);
      toast({ title: "Přehled učení se nepodařilo načíst", description: "Studijní techniky můžeš použít i bez něj.", variant: "destructive" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadStudentLearningOverview(userId, new Date(), cachedLessonGroups ?? [])
      .then((data) => { if (!cancelled) setOverview(data); })
      .catch(() => { if (!cancelled) toast({ title: "Přehled učení se nepodařilo načíst", description: "Studijní techniky můžeš použít i bez něj.", variant: "destructive" }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, cachedLessonGroups, lessonsPending, lessonsError, toast]);

  const subjects = overview?.lessonGroups.map((group) => group.subject) ?? [];
  const activeSubject = resolveLearningSubject(subjects, overview?.activeSubject ?? null, selectedSubject);
  const activeTopics = overview?.topics.filter((topic) => topic.subject === activeSubject) ?? [];
  const currentTopicId = activeTopics.find((topic) => topic.id === overview?.currentTopicId)?.id
    ?? activeTopics.find((topic) => topic.sessionsCount > 0 && !topic.mastered)?.id
    ?? activeTopics.find((topic) => !topic.mastered)?.id
    ?? null;
  const examTopic = overview?.nextExam ? pickExamPreparationTopic(overview.topics, overview.nextExam.lessonIds) : null;
  const visibleTopics = activeTopics.slice(0, pathVisibleCount);
  const progress = overview ? Math.min(100, (overview.todaySessions / overview.dailyGoal) * 100) : 0;
  const recentLessonIds = (overview?.topics ?? [])
    .filter((topic) => topic.lastPracticedAt)
    .sort((a, b) => (b.lastPracticedAt ?? "").localeCompare(a.lastPracticedAt ?? ""))
    .map((topic) => topic.id);

  useEffect(() => {
    setPathVisibleCount(PATH_PAGE_SIZE);
    setOtherLessonId("");
  }, [activeSubject]);

  const scrollBehavior = (): ScrollBehavior => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const startPractice = (lessonId: string | null, minutes: number) => {
    const method = pickStudyMethod(methods, preferredIds);
    if (!method) {
      toast({ title: "Kvíz zatím nelze spustit", description: "Studijní metody se nepodařilo načíst. Zkus obnovit stránku.", variant: "destructive" });
      return;
    }
    onPractice(method, lessonId, minutes);
  };
  const startQuiz = (lessonId: string | null) => startPractice(lessonId, 5);
  const startExamPreparation = () => {
    if (examTopic && overview?.nextExam) {
      startPractice(examTopic.id, examPreparationMinutes(overview.nextExam.days));
      return;
    }
    // Bez skutečné vazby testu na dostupnou lekci se nic nevymýšlí.
    startQuiz(overview?.lastLesson?.id ?? null);
  };

  const selectSubject = (subject: string) => {
    setSelectedSubject(subject);
    storeLearningSubject(userId, subject);
  };

  const runMode = (id: ModeId) => {
    if (id === "cards" || id === "summary") setStudyAction(id);
    if (id === "quiz") startQuiz(overview?.lastLesson?.id ?? null);
    if (id === "exam") startExamPreparation();
    if (id === "material") navigate("/student/z-materialu");
    if (id === "chat") setChatOpen(true);
    if (id === "path") {
      pathRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      subjectSwitchRef.current?.focus({ preventScroll: true });
    }
    if (id === "tricks") {
      const target = document.getElementById("triky-na-uceni");
      target?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      target?.focus({ preventScroll: true });
    }
  };

  return (
    <div className="mb-10 space-y-8">
      <section aria-labelledby="learning-welcome" className="learning-welcome-card">
        <div className="flex items-start gap-4 sm:items-center">
          <ProfileAvatarBubble userId={userId} size={88} editable={false} showStreakBadge={false} shape="square" />
          <div className="min-w-0 flex-1">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" aria-hidden />Tvůj dnešní cíl</p>
            <h2 id="learning-welcome" className="font-heading text-2xl font-bold sm:text-3xl">Co dnes zvládneš?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Načítám tvůj pokrok…" : overview?.todaySessions ? "Denní cíl máš splněný. Skvělá práce!" : "Jedno krátké procvičování ti dnes stačí k dobrému začátku."}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
            <span>Denní cíl: 1 dokončené cvičení</span>
            <span>{overview ? `${Math.min(overview.todaySessions, overview.dailyGoal)} / ${overview.dailyGoal}` : "…"}</span>
          </div>
          <Progress value={progress} aria-label="Postup dnešního cíle" className="h-3" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="learning-stat-pill"><Flame className="h-4 w-4" aria-hidden />Série: {czechDays(overview?.streakDays ?? 0)}</span>
          <span className="learning-stat-pill"><Star className="h-4 w-4" aria-hidden />{overview?.xp ?? 0} XP</span>
          <span className="learning-stat-pill"><Trophy className="h-4 w-4" aria-hidden />{overview?.masteredCount === 1 ? "1 zvládnuté téma" : `${overview?.masteredCount ?? 0} ${(overview?.masteredCount ?? 0) >= 2 && (overview?.masteredCount ?? 0) <= 4 ? "zvládnutá témata" : "zvládnutých témat"}`}</span>
        </div>
      </section>

      <section aria-labelledby="daily-missions">
        <div className="mb-3 flex items-center gap-2">
          <TimerReset className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="daily-missions" className="font-heading text-xl font-semibold">Dnešní mise</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(overview?.missions ?? []).map((mission) => (
            <button
              key={mission.id}
              type="button"
              className="learning-mission-card"
              onClick={() => mission.action === "material" ? navigate("/student/z-materialu") : startQuiz(mission.lessonId)}
              aria-label={`${mission.title}, ${missionStateLabel(mission.state)}`}
            >
              <span className={`learning-mission-state learning-mission-state--${mission.state}`}>
                {mission.state === "done" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}{missionStateLabel(mission.state)}
              </span>
              <span className="mt-3 block font-heading font-semibold">{mission.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{mission.detail}</span>
              <span className="mt-3 block text-sm font-semibold text-primary">{mission.state === "done" ? "Procvičit znovu" : "Spustit"} →</span>
            </button>
          ))}
          {loading && <p className="text-sm text-muted-foreground">Připravuji dnešní mise…</p>}
          {!loading && !overview && <p className="text-sm text-muted-foreground">Mise teď nejsou dostupné, ale všechny režimy můžeš použít níže.</p>}
        </div>
      </section>

      <section aria-labelledby="learning-modes">
        <h2 id="learning-modes" className="sr-only">Vyber si, co chceš dělat</h2>
        <div className="learning-mode-grid">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const title = mode.id === "exam" && !loading && !overview?.nextExam ? "Žádný test na obzoru" : mode.title;
            const detail = mode.id === "exam"
              ? overview?.nextExam
                ? examTopic ? `${examPreparationMinutes(overview.nextExam.days)} min · nejdřív slabá místa` : examDayLabel(overview.nextExam.days)
                : loading ? mode.detail : "Zopakuj si poslední lekci"
              : mode.detail;
            return (
              <button key={mode.id} type="button" onClick={() => runMode(mode.id)} className={`dashboard-tile dashboard-tile--${mode.tone} learning-mode-tile`} aria-label={`${title}: ${detail}`}>
                <span className="dashboard-tile-body">
                  <Icon className="dashboard-tile-icon learning-mode-icon" aria-hidden />
                  <span className="dashboard-tile-copy">
                    <span className="dashboard-tile-title">{title}</span>
                    <span className="dashboard-tile-description">{detail}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {overview?.nextExam && <p className="mt-2 text-sm text-muted-foreground">Nejbližší test: {overview.nextExam.title}</p>}
      </section>

      <section ref={pathRef} aria-labelledby="learning-path" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="learning-path" className="flex items-center gap-2 font-heading text-xl font-semibold"><Map className="h-5 w-5 text-primary" aria-hidden />Moje cesta</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeSubject ? `${activeSubject} · zeleně hotovo, fialově právě teď` : "Zvládnutí se ukáže po procvičení tvých lekcí."}</p>
          </div>
        </div>
        {subjects.length > 0 && (
          <div
            ref={subjectSwitchRef}
            role="group"
            aria-label="Předmět cesty"
            tabIndex={-1}
            className="mb-5 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {subjects.map((subject) => (
              <Button
                key={subject}
                type="button"
                variant={subject === activeSubject ? "default" : "outline"}
                size="sm"
                className="min-h-11 shrink-0"
                aria-pressed={subject === activeSubject}
                onClick={() => selectSubject(subject)}
              >
                {subject}
              </Button>
            ))}
          </div>
        )}
        {activeSubject === "Ostatní" && activeTopics.length > 0 && (
          <div className="mb-4">
            <SearchableSelect
              value={otherLessonId}
              onValueChange={(id) => {
                setOtherLessonId(id);
                const index = activeTopics.findIndex((topic) => topic.id === id);
                if (index >= 0) setPathVisibleCount((count) => Math.max(count, index + 1));
              }}
              options={activeTopics.map((topic) => ({
                value: topic.id,
                label: topic.title,
                subtitle: topic.textbook && topic.textbook !== "Ostatní" ? topic.textbook : undefined,
              }))}
              placeholder="Vyber lekci bez předmětu"
              label="Hledat lekci bez předmětu"
              triggerLabel="Vyhledat v Ostatních"
              searchPlaceholder="Hledat v názvu nebo učebnici…"
              emptySearchMessage="Nic jsme nenašli. Zkus jiné slovo."
              showSelectedSubtitle
              growing
            />
          </div>
        )}
        {visibleTopics.length > 0 ? (
          <>
            <ol className="learning-path-list">
              {visibleTopics.map((topic, index) => {
                const state = topic.mastered ? "done" : topic.id === currentTopicId ? "current" : "upcoming";
                return (
                  <li key={topic.id} className={`learning-path-step learning-path-step--${state}`}>
                    <span className="learning-path-marker" aria-hidden>{state === "done" ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{topic.title}</span>
                      <span className="text-xs text-muted-foreground">{state === "done" ? "Zvládnuto" : state === "current" ? "Právě teď" : topic.sessionsCount ? `${Math.round(topic.masteryPercent)} % · ještě potrénovat` : "Zatím neprocvičeno"}</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => startQuiz(topic.id)}>{state === "done" ? "Zopakovat" : "Procvičit"}</Button>
                  </li>
                );
              })}
            </ol>
            {activeTopics.length > PATH_PAGE_SIZE && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-xs text-muted-foreground">Zobrazeno {visibleTopics.length} z {activeTopics.length}</p>
                {visibleTopics.length < activeTopics.length && (
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setPathVisibleCount((count) => count + PATH_PAGE_SIZE)}>
                    Zobrazit další ({Math.min(PATH_PAGE_SIZE, activeTopics.length - visibleTopics.length)})
                  </Button>
                )}
                {pathVisibleCount > PATH_PAGE_SIZE && (
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setPathVisibleCount(PATH_PAGE_SIZE)}>Zobrazit méně</Button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{loading ? "Načítám témata…" : "Zatím nemáš dostupné lekce. Jakmile je učitel zveřejní, uvidíš tady svoji cestu."}</p>
        )}
      </section>

      <StudyLessonActionDialog
        action={studyAction}
        onOpenChange={(open) => { if (!open) setStudyAction(null); }}
        userId={userId}
        initialLessonId={overview?.lastLesson?.id ?? null}
        recentLessonIds={recentLessonIds}
        onError={(message) => toast({ title: "Studijní pomůcka se nepodařila", description: message, variant: "destructive" })}
      />
      <BezlaiTutorChat
        question={overview?.lastLesson ? `Chci se učit z lekce ${overview.lastLesson.title}.` : "Chci se naučit nové učivo."}
        subject={activeSubject ?? undefined}
        open={chatOpen}
        onOpenChange={setChatOpen}
        hideTrigger
      />
    </div>
  );
}
