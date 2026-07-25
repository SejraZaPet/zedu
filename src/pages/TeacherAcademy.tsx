import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, CheckCircle2, Circle, Award, Play } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_accredited: boolean;
  accreditation_number: string | null;
  sort_order: number;
  moduleCount?: number;
  enrollment?: { id: string; completed_at: string | null } | null;
  completedCount?: number;
}

interface Module {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  sort_order: number;
}

const renderContent = (content: string) => {
  // Simple markdown-lite: ## heading, paragraphs
  const lines = content.split("\n");
  const out: JSX.Element[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(<p key={out.length} className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{para.join("\n").trim()}</p>);
      para = [];
    }
  };
  lines.forEach((l) => {
    if (l.startsWith("## ")) {
      flush();
      out.push(<h3 key={out.length} className="font-heading text-lg font-semibold mt-4 mb-1">{l.slice(3)}</h3>);
    } else if (l.startsWith("# ")) {
      flush();
      out.push(<h2 key={out.length} className="font-heading text-xl font-semibold mt-4 mb-1">{l.slice(2)}</h2>);
    } else {
      para.push(l);
    }
  });
  flush();
  return <div className="space-y-2">{out}</div>;
};

const TeacherAcademy = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrollmentCompletedAt, setEnrollmentCompletedAt] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const { data: courseRows } = await supabase
      .from("academy_courses")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (!courseRows) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const courseIds = courseRows.map((c) => c.id);
    const [{ data: modCounts }, { data: enrolls }] = await Promise.all([
      supabase.from("academy_modules").select("id, course_id").in("course_id", courseIds),
      user
        ? supabase.from("academy_enrollments").select("id, course_id, completed_at").eq("teacher_id", user.id).in("course_id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const enrollmentIds = (enrolls || []).map((e: any) => e.id);
    const { data: completions } = enrollmentIds.length
      ? await supabase.from("academy_module_completions").select("enrollment_id, module_id").in("enrollment_id", enrollmentIds)
      : { data: [] as any[] };

    const modByCourse = new Map<string, number>();
    (modCounts || []).forEach((m: any) => modByCourse.set(m.course_id, (modByCourse.get(m.course_id) || 0) + 1));

    const enrollByCourse = new Map<string, { id: string; completed_at: string | null }>();
    (enrolls || []).forEach((e: any) => enrollByCourse.set(e.course_id, { id: e.id, completed_at: e.completed_at }));

    const completionsByEnrollment = new Map<string, number>();
    (completions || []).forEach((c: any) => completionsByEnrollment.set(c.enrollment_id, (completionsByEnrollment.get(c.enrollment_id) || 0) + 1));

    setCourses(
      courseRows.map((c) => {
        const enr = enrollByCourse.get(c.id) || null;
        return {
          ...c,
          moduleCount: modByCourse.get(c.id) || 0,
          enrollment: enr,
          completedCount: enr ? completionsByEnrollment.get(enr.id) || 0 : 0,
        };
      })
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openCourse = async (courseId: string) => {
    if (!user) return;
    setSelectedCourseId(courseId);
    setActiveModuleId(null);

    // Ensure enrollment exists
    let { data: enroll } = await supabase
      .from("academy_enrollments")
      .select("id, completed_at")
      .eq("teacher_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!enroll) {
      const { data: created, error } = await supabase
        .from("academy_enrollments")
        .insert({ teacher_id: user.id, course_id: courseId })
        .select("id, completed_at")
        .single();
      if (error) {
        toast.error("Nepodařilo se zapsat do kurzu");
        return;
      }
      enroll = created;
    }
    setEnrollmentId(enroll!.id);
    setEnrollmentCompletedAt(enroll!.completed_at);

    const [{ data: mods }, { data: comps }] = await Promise.all([
      supabase.from("academy_modules").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
      supabase.from("academy_module_completions").select("module_id").eq("enrollment_id", enroll!.id),
    ]);
    setModules((mods || []) as Module[]);
    setCompletedIds(new Set((comps || []).map((c: any) => c.module_id)));
    if (mods && mods.length > 0) setActiveModuleId(mods[0].id);
  };

  const toggleModuleDone = async (moduleId: string) => {
    if (!enrollmentId) return;
    const done = completedIds.has(moduleId);
    if (done) {
      const { error } = await supabase
        .from("academy_module_completions")
        .delete()
        .eq("enrollment_id", enrollmentId)
        .eq("module_id", moduleId);
      if (error) return toast.error("Chyba");
      const next = new Set(completedIds);
      next.delete(moduleId);
      setCompletedIds(next);
      if (enrollmentCompletedAt) {
        await supabase.from("academy_enrollments").update({ completed_at: null }).eq("id", enrollmentId);
        setEnrollmentCompletedAt(null);
      }
    } else {
      const { error } = await supabase
        .from("academy_module_completions")
        .insert({ enrollment_id: enrollmentId, module_id: moduleId });
      if (error) return toast.error("Chyba");
      const next = new Set(completedIds);
      next.add(moduleId);
      setCompletedIds(next);
      if (modules.length > 0 && next.size === modules.length && !enrollmentCompletedAt) {
        const nowIso = new Date().toISOString();
        await supabase.from("academy_enrollments").update({ completed_at: nowIso }).eq("id", enrollmentId);
        setEnrollmentCompletedAt(nowIso);
        toast.success("🎉 Kurz dokončen!");
      }
    }
  };

  const backToList = () => {
    setSelectedCourseId(null);
    setModules([]);
    setCompletedIds(new Set());
    setEnrollmentId(null);
    setEnrollmentCompletedAt(null);
    fetchCourses();
  };

  const activeModule = useMemo(() => modules.find((m) => m.id === activeModuleId) || null, [modules, activeModuleId]);
  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId) || null, [courses, selectedCourseId]);
  const progressPct = modules.length > 0 ? Math.round((completedIds.size / modules.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        {!selectedCourseId ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-semibold">ZEdu Akademie</h1>
                <p className="text-sm text-muted-foreground">Kurzy a webináře pro učitele.</p>
              </div>
            </div>

            {loading ? (
              <p className="text-muted-foreground">Načítání…</p>
            ) : courses.length === 0 ? (
              <p className="text-muted-foreground">Zatím zde nejsou žádné kurzy.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((c) => {
                  const pct = c.moduleCount ? Math.round(((c.completedCount || 0) / c.moduleCount) * 100) : 0;
                  return (
                    <Card key={c.id} className="p-5 flex flex-col hover:border-primary/40 transition-colors">
                      {c.cover_image_url && (
                        <img src={c.cover_image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
                      )}
                      <div className="flex items-start gap-2 mb-2">
                        <h2 className="font-heading text-lg font-semibold flex-1">{c.title}</h2>
                        {c.is_accredited && (
                          <Badge variant="secondary" className="gap-1">
                            <Award className="w-3 h-3" /> DVPP
                          </Badge>
                        )}
                      </div>
                      {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{c.description}</p>}
                      <div className="text-xs text-muted-foreground mb-3">{c.moduleCount} modulů</div>
                      {c.enrollment && (
                        <div className="mb-3">
                          <Progress value={pct} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-1">
                            {c.enrollment.completed_at ? "✓ Dokončeno" : `${c.completedCount}/${c.moduleCount} · ${pct} %`}
                          </div>
                        </div>
                      )}
                      <Button className="mt-auto" onClick={() => openCourse(c.id)}>
                        <Play className="w-4 h-4 mr-1" /> {c.enrollment ? "Pokračovat" : "Zahájit kurz"}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={backToList} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na kurzy
            </Button>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-heading text-2xl font-semibold">{selectedCourse?.title}</h1>
                {selectedCourse?.is_accredited && (
                  <Badge variant="secondary" className="gap-1"><Award className="w-3 h-3" /> DVPP</Badge>
                )}
              </div>
              {selectedCourse?.description && (
                <p className="text-sm text-muted-foreground mb-3">{selectedCourse.description}</p>
              )}
              <Progress value={progressPct} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {completedIds.size}/{modules.length} modulů · {progressPct} %
              </div>
              {enrollmentCompletedAt && (
                <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <span>🎉 Gratulujeme, kurz je dokončen!</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
              <aside className="border border-border rounded-xl bg-card p-2 h-fit md:sticky md:top-4">
                <ul className="space-y-1">
                  {modules.map((m, i) => {
                    const done = completedIds.has(m.id);
                    const active = m.id === activeModuleId;
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => setActiveModuleId(m.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-start gap-2 transition-colors ${
                            active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <span className="flex-1">
                            <span className="text-xs text-muted-foreground">Modul {i + 1}</span>
                            <span className="block">{m.title}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>

              <section className="border border-border rounded-xl bg-card p-6">
                {activeModule ? (
                  <>
                    <h2 className="font-heading text-xl font-semibold mb-3">{activeModule.title}</h2>
                    {activeModule.video_url && (
                      <div className="mb-4 aspect-video rounded-lg overflow-hidden bg-muted">
                        <iframe
                          src={activeModule.video_url}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={activeModule.title}
                        />
                      </div>
                    )}
                    {activeModule.content && renderContent(activeModule.content)}
                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                      <Button
                        variant={completedIds.has(activeModule.id) ? "outline" : "default"}
                        onClick={() => toggleModuleDone(activeModule.id)}
                      >
                        {completedIds.has(activeModule.id) ? (
                          <><CheckCircle2 className="w-4 h-4 mr-1" /> Splněno – zrušit</>
                        ) : (
                          <><Circle className="w-4 h-4 mr-1" /> Označit jako dokončené</>
                        )}
                      </Button>
                      {(() => {
                        const idx = modules.findIndex((m) => m.id === activeModule.id);
                        const next = modules[idx + 1];
                        return next ? (
                          <Button variant="ghost" onClick={() => setActiveModuleId(next.id)}>
                            Další modul →
                          </Button>
                        ) : null;
                      })()}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Vyberte modul ze seznamu.</p>
                )}
              </section>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherAcademy;
