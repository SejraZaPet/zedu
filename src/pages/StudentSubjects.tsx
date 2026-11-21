import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Book, Clock, Flag, Library, MessageSquare, SquareCheckBig, type LucideIcon } from "lucide-react";
import { formatNewsCount, newsLabel, type NewsKind } from "@/lib/subject-news";

const NEWS_ICONS: [NewsKind, LucideIcon][] = [["wall", MessageSquare], ["material", Book], ["task", SquareCheckBig], ["test", Flag]];
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStudentCourses, nextLessonLabel, type StudentCourse } from "@/lib/student-courses";

const COURSE_PALETTES = [
  ["--dashboard-tile-learn-from", "--dashboard-tile-learn-to"],
  ["--dashboard-tile-subjects-from", "--dashboard-tile-subjects-to"],
  ["--dashboard-tile-textbooks-from", "--dashboard-tile-textbooks-to"],
  ["--dashboard-tile-assignments-from", "--dashboard-tile-assignments-to"],
  ["--dashboard-tile-notebook-from", "--dashboard-tile-notebook-to"],
  ["--dashboard-tile-portfolio-from", "--dashboard-tile-portfolio-to"],
  ["--dashboard-tile-schedule-from", "--dashboard-tile-schedule-to"],
] as const;

export function coursePalette(course: Pick<StudentCourse, "subjectId" | "subjectName">) {
  const identity = course.subjectId ?? course.subjectName;
  let hash = 0;
  for (let index = 0; index < identity.length; index++) hash = (hash * 31 + identity.charCodeAt(index)) >>> 0;
  return COURSE_PALETTES[hash % COURSE_PALETTES.length];
}

function StudentCourseCard({ course, now }: { course: StudentCourse; now: Date }) {
  const [from, to] = coursePalette(course);
  const style = {
    "--student-course-from": `hsl(var(${from}))`,
    "--student-course-to": `hsl(var(${to}))`,
  } as CSSProperties;
  const audienceLabel = course.audienceKind === "group" ? "skupina" : "třída";
  return (
    <Link
      to={course.target}
      className="student-course-card"
      style={style}
      aria-label={`Předmět ${course.subjectName}, ${audienceLabel} ${course.audienceName}${course.news.total ? `, ${course.news.total} nových` : ""}`}
      data-testid="student-course-card"
    >
      <div className="student-course-card-top">
        <h2>{course.subjectName}</h2>
        <p>{course.audienceKind === "group" ? "Skupina" : "Třída"} {course.audienceName}</p>
      </div>
      <div className="student-course-card-body">
        {course.news.total > 0 && (
          <ul className="student-course-card-badges" aria-label="Novinky" data-testid="student-course-news">
            {NEWS_ICONS.filter(([kind]) => course.news[kind] > 0).map(([kind, Icon]) => (
              <li key={kind} className="student-course-badge" aria-label={newsLabel(kind, course.news[kind])}>
                <Icon aria-hidden="true" /> {formatNewsCount(course.news[kind])} nov{course.news[kind] === 1 ? "é" : "ých"}
              </li>
            ))}
          </ul>
        )}
        {(course.openAssignments > 0 || course.hasUpcomingExam) && (
          <div className="student-course-card-badges">
            {course.openAssignments > 0 && (
              <span className="student-course-badge">
                <SquareCheckBig aria-hidden="true" />
                {course.openAssignments} {course.openAssignments === 1 ? "úloha" : course.openAssignments < 5 ? "úlohy" : "úloh"} k odevzdání
              </span>
            )}
            {course.hasUpcomingExam && (
              <span className="student-course-badge student-course-badge--exam">
                <Flag aria-hidden="true" /> Test do 14 dní
              </span>
            )}
          </div>
        )}
        {course.nextLesson && (
          <p className="student-course-next">
            <Clock aria-hidden="true" />
            <span>Další hodina: {nextLessonLabel(course.nextLesson, now)}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

export default function StudentSubjects() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchStudentCourses(user.id, now)
      .then((rows) => { if (!cancelled) setCourses(rows); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user, navigate, now, reloadKey]);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="flex-1 container mx-auto w-full max-w-6xl px-4 py-8">
        <Button variant="ghost" asChild className="mb-5 -ml-3 min-h-11">
          <Link to="/student"><ArrowLeft aria-hidden="true" /> Zpět na přehled</Link>
        </Button>
        <header className="mb-7 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand-sm text-white">
            <Library className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje předměty</h1>
            <p className="mt-1 text-muted-foreground">Tvoje třídy, skupiny a kurzy na jednom místě.</p>
          </div>
        </header>

        {loading ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground" role="status">Načítám tvoje předměty…</p>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center" role="alert">
            <p>Předměty se nepodařilo načíst. Zkus to prosím znovu.</p>
            <Button className="mt-4 min-h-11" onClick={() => setReloadKey((key) => key + 1)}>Zkusit znovu</Button>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
            <Library className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden="true" />
            <h2 className="font-heading text-xl font-semibold">Zatím tu nemáš žádný předmět</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Zatím nejsi v žádné třídě ani skupině. Požádej učitele o kód nebo se připoj kódem.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Kód třídy se zadává při registraci.</p>
          </div>
        ) : (
          <section aria-label="Seznam mých předmětů" className="student-course-grid">
            {courses.map((course) => <StudentCourseCard key={course.id} course={course} now={now} />)}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
