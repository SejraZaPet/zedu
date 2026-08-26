import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MarkdownImageToolbar from "@/components/admin/MarkdownImageToolbar";
import MarkdownContent from "@/components/MarkdownContent";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft, Award, FileBadge2, Users2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

type Audience = "teacher" | "student" | "both";
type RevenueType = "Bezli" | "creator_share" | null;

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_accredited: boolean;
  accreditation_number: string | null;
  is_published: boolean;
  sort_order: number;
  audience: Audience;
  category: string | null;
  issues_certificate: boolean;
  requires_evidence: boolean;
  price: number | null;
  revenue_type: RevenueType;
  creator_id: string | null;
  platform_commission_percent: number | null;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  sort_order: number;
}

interface CourseStats {
  course_id: string;
  course_title: string;
  audience: Audience;
  issues_certificate: boolean;
  price: number | null;
  revenue_type: RevenueType;
  enrollments_count: number;
  completions_count: number;
  certificates_count: number;
  teachers_completed: number;
  students_completed: number;
}

const audienceLabel = (a: Audience) => a === "teacher" ? "Učitelé" : a === "student" ? "Žáci" : "Učitelé + žáci";

const COURSE_CATEGORIES = [
  "Pedagogika",
  "Technologie ve výuce",
  "Hodnocení a zpětná vazba",
  "Inkluze a podpora",
  "Wellbeing a klima třídy",
  "Řízení školy",
  "Práce s Bezli",
];

const AcademyCoursesManager = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  const [courseDlgOpen, setCourseDlgOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<Partial<Course>>({});

  const [moduleDlgOpen, setModuleDlgOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState<Partial<Module>>({});
  const [modulePreview, setModulePreview] = useState(false);
  const moduleTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [stats, setStats] = useState<CourseStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("academy_courses").select("*").order("sort_order", { ascending: true });
    setCourses((data || []) as Course[]);
    setLoading(false);
  }, []);

  const fetchModules = useCallback(async (courseId: string) => {
    const { data } = await supabase
      .from("academy_modules").select("*").eq("course_id", courseId)
      .order("sort_order", { ascending: true });
    setModules((data || []) as Module[]);
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const { data, error } = await supabase.rpc("academy_stats_by_course");
    if (error) toast.error("Statistiky se nepodařilo načíst", { description: error.message });
    setStats((data || []) as CourseStats[]);
    setStatsLoading(false);
  }, []);

  useEffect(() => { fetchCourses(); fetchStats(); }, [fetchCourses, fetchStats]);
  useEffect(() => { if (selectedCourse) fetchModules(selectedCourse.id); }, [selectedCourse, fetchModules]);

  const openNewCourse = () => {
    setCourseForm({
      title: "", description: "", is_published: false, is_accredited: false,
      audience: "teacher", category: null, issues_certificate: false, requires_evidence: false, price: null,
      revenue_type: null, creator_id: null, platform_commission_percent: null,
      sort_order: courses.length,
    });
    setCourseDlgOpen(true);
  };
  const openEditCourse = (c: Course) => { setCourseForm(c); setCourseDlgOpen(true); };

  const saveCourse = async () => {
    if (!courseForm.title?.trim()) return toast.error("Zadejte název");
    const payload = {
      title: courseForm.title,
      description: courseForm.description || null,
      cover_image_url: courseForm.cover_image_url || null,
      is_accredited: !!courseForm.is_accredited,
      accreditation_number: courseForm.accreditation_number || null,
      is_published: !!courseForm.is_published,
      sort_order: courseForm.sort_order ?? 0,
      audience: (courseForm.audience || "teacher") as Audience,
      category: courseForm.category || null,
      issues_certificate: !!courseForm.issues_certificate,
      requires_evidence: !!courseForm.requires_evidence,
      price: courseForm.price != null && courseForm.price !== ("" as any) ? Number(courseForm.price) : null,
      revenue_type: courseForm.revenue_type || null,
      creator_id: courseForm.creator_id || null,
      platform_commission_percent:
        courseForm.revenue_type === "creator_share" && courseForm.platform_commission_percent != null
          ? Number(courseForm.platform_commission_percent) : null,
    };
    if (courseForm.id) {
      const { error } = await supabase.from("academy_courses").update(payload).eq("id", courseForm.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("academy_courses").insert(payload);
      if (error) return toast.error(error.message);
    }
    setCourseDlgOpen(false);
    toast.success("Uloženo");
    fetchCourses(); fetchStats();
  };
  const deleteCourse = async (id: string) => {
    if (!confirm("Smazat kurz včetně všech modulů?")) return;
    const { error } = await supabase.from("academy_courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno"); fetchCourses(); fetchStats();
    if (selectedCourse?.id === id) setSelectedCourse(null);
  };

  const openNewModule = () => {
    if (!selectedCourse) return;
    setModuleForm({ course_id: selectedCourse.id, title: "", content: "", sort_order: modules.length });
    setModuleDlgOpen(true);
  };
  const openEditModule = (m: Module) => { setModuleForm(m); setModuleDlgOpen(true); };
  const saveModule = async () => {
    if (!moduleForm.title?.trim()) return toast.error("Zadejte název");
    const payload = {
      course_id: moduleForm.course_id!,
      title: moduleForm.title,
      content: moduleForm.content || null,
      video_url: moduleForm.video_url || null,
      sort_order: moduleForm.sort_order ?? 0,
    };
    if (moduleForm.id) {
      const { error } = await supabase.from("academy_modules").update(payload).eq("id", moduleForm.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("academy_modules").insert(payload);
      if (error) return toast.error(error.message);
    }
    setModuleDlgOpen(false); toast.success("Uloženo");
    if (selectedCourse) fetchModules(selectedCourse.id);
  };
  const deleteModule = async (id: string) => {
    if (!confirm("Smazat modul?")) return;
    const { error } = await supabase.from("academy_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    if (selectedCourse) fetchModules(selectedCourse.id);
  };

  // --- Module editor view ---
  if (selectedCourse) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedCourse(null)} className="mb-3">
          <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na kurzy
        </Button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-xl font-semibold">{selectedCourse.title}</h2>
            <p className="text-sm text-muted-foreground">Moduly kurzu</p>
          </div>
          <Button size="sm" onClick={openNewModule}><Plus className="w-4 h-4 mr-1" /> Nový modul</Button>
        </div>

        <div className="space-y-2">
          {modules.map((m, i) => (
            <Card key={m.id} className="p-3 flex items-center gap-3">
              <div className="text-sm text-muted-foreground w-8 text-center">{i + 1}</div>
              <div className="flex-1">
                <div className="font-medium">{m.title}</div>
                {m.video_url && <div className="text-xs text-muted-foreground">🎥 {m.video_url}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEditModule(m)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => deleteModule(m.id)}><Trash2 className="w-4 h-4" /></Button>
            </Card>
          ))}
          {modules.length === 0 && <p className="text-sm text-muted-foreground">Žádné moduly.</p>}
        </div>

        <Sheet open={moduleDlgOpen} onOpenChange={setModuleDlgOpen}>
          <SheetContent side="right" className={modulePreview ? "sm:max-w-4xl overflow-y-auto" : "sm:max-w-xl overflow-y-auto"}>
            <SheetHeader><SheetTitle>{moduleForm.id ? "Upravit modul" : "Nový modul"}</SheetTitle></SheetHeader>
            <div className="space-y-3 mt-4">
              <div><Label>Název</Label><Input value={moduleForm.title || ""} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} /></div>
              <div><Label>Pořadí</Label><Input type="number" value={moduleForm.sort_order ?? 0} onChange={(e) => setModuleForm({ ...moduleForm, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Video URL (volitelné – embed odkaz)</Label><Input value={moduleForm.video_url || ""} onChange={(e) => setModuleForm({ ...moduleForm, video_url: e.target.value })} /></div>
              <div>
                <Label>Obsah (markdown: ## nadpis, - odrážka, **tučně**, ![obrázek](url))</Label>
                <div className="mt-2">
                  <MarkdownImageToolbar
                    textareaRef={moduleTextareaRef}
                    value={moduleForm.content || ""}
                    onChange={(next) => setModuleForm((f) => ({ ...f, content: next }))}
                    folder={`academy/${moduleForm.course_id || "obecne"}`}
                    showPreviewToggle
                    previewOn={modulePreview}
                    onTogglePreview={() => setModulePreview((p) => !p)}
                  />
                </div>
                <div className={modulePreview ? "grid lg:grid-cols-2 gap-4" : ""}>
                  <Textarea ref={moduleTextareaRef} rows={16} className="font-mono text-sm" value={moduleForm.content || ""} onChange={(e) => setModuleForm({ ...moduleForm, content: e.target.value })} />
                  {modulePreview && (
                    <div className="rounded-lg border border-border p-4 overflow-y-auto max-h-[420px]">
                      <MarkdownContent content={moduleForm.content || ""} />
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={saveModule} className="w-full">Uložit</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // --- Courses list + stats ---
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Bezli Akademie</h2>
          <p className="text-sm text-muted-foreground">Správa kurzů, modulů a přehled statistik.</p>
        </div>
        <Button onClick={openNewCourse}><Plus className="w-4 h-4 mr-1" /> Nový kurz</Button>
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">Kurzy</TabsTrigger>
          <TabsTrigger value="stats">Statistiky</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Načítání…</p>
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <Card key={c.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.title}</span>
                      {c.is_published ? <Badge variant="default">Publikováno</Badge> : <Badge variant="secondary">Koncept</Badge>}
                      <Badge variant="outline" className="gap-1"><Users2 className="w-3 h-3" /> {audienceLabel(c.audience)}</Badge>
                      {c.is_accredited && (<Badge variant="outline" className="gap-1"><Award className="w-3 h-3" /> DVPP</Badge>)}
                      {c.issues_certificate && (<Badge variant="outline" className="gap-1"><FileBadge2 className="w-3 h-3" /> Certifikát</Badge>)}
                      {c.price != null && Number(c.price) > 0 && (
                        <Badge variant="outline">{Number(c.price).toLocaleString("cs-CZ")} Kč</Badge>
                      )}
                    </div>
                    {c.description && <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedCourse(c)}>Moduly</Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditCourse(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCourse(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </Card>
              ))}
              {courses.length === 0 && <p className="text-sm text-muted-foreground">Žádné kurzy.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          {statsLoading ? (
            <p className="text-muted-foreground">Načítání…</p>
          ) : stats.length === 0 ? (
            <p className="text-muted-foreground">Zatím žádná data.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Kurzů celkem</div>
                  <div className="text-2xl font-heading font-semibold">{stats.length}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Zápisů</div>
                  <div className="text-2xl font-heading font-semibold">{stats.reduce((s, x) => s + Number(x.enrollments_count || 0), 0)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Dokončení</div>
                  <div className="text-2xl font-heading font-semibold">{stats.reduce((s, x) => s + Number(x.completions_count || 0), 0)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Vydaných certifikátů</div>
                  <div className="text-2xl font-heading font-semibold flex items-center gap-2">
                    <FileBadge2 className="w-5 h-5 text-primary" />
                    {stats.reduce((s, x) => s + Number(x.certificates_count || 0), 0)}
                  </div>
                </Card>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="p-2">Kurz</th>
                      <th className="p-2">Cílová skupina</th>
                      <th className="p-2 text-right">Zápisů</th>
                      <th className="p-2 text-right">Dokončení</th>
                      <th className="p-2 text-right">Učitelé</th>
                      <th className="p-2 text-right">Žáci</th>
                      <th className="p-2 text-right">Certifikátů</th>
                      <th className="p-2 text-right">Cena / typ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.course_id} className="border-t border-border">
                        <td className="p-2 font-medium">{s.course_title}</td>
                        <td className="p-2">{audienceLabel(s.audience)}</td>
                        <td className="p-2 text-right">{s.enrollments_count}</td>
                        <td className="p-2 text-right">{s.completions_count}</td>
                        <td className="p-2 text-right"><GraduationCap className="w-3 h-3 inline mr-1" />{s.teachers_completed}</td>
                        <td className="p-2 text-right">{s.students_completed}</td>
                        <td className="p-2 text-right">{s.issues_certificate ? s.certificates_count : "—"}</td>
                        <td className="p-2 text-right text-xs">
                          {s.price && Number(s.price) > 0 ? (
                            <div>
                              <div>{Number(s.price).toLocaleString("cs-CZ")} Kč</div>
                              <div className="text-muted-foreground">
                                {s.revenue_type === "Bezli" ? "Bezli" : s.revenue_type === "creator_share" ? "Tvůrce" : "—"}
                              </div>
                            </div>
                          ) : (<span className="text-muted-foreground">Zdarma</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Placené kurzy zatím nevybírají platby – zobrazená cena je jen informativní příprava na spuštění plateb.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={courseDlgOpen} onOpenChange={setCourseDlgOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{courseForm.id ? "Upravit kurz" : "Nový kurz"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Název</Label><Input value={courseForm.title || ""} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
            <div><Label>Popis</Label><Textarea rows={3} value={courseForm.description || ""} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} /></div>
            <div><Label>URL obálky (obrázek)</Label><Input value={courseForm.cover_image_url || ""} onChange={(e) => setCourseForm({ ...courseForm, cover_image_url: e.target.value })} /></div>

            <div>
              <Label>Cílová skupina</Label>
              <Select value={courseForm.audience || "teacher"} onValueChange={(v) => setCourseForm({ ...courseForm, audience: v as Audience })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Učitelé</SelectItem>
                  <SelectItem value="student">Žáci</SelectItem>
                  <SelectItem value="both">Učitelé i žáci</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Téma / kategorie</Label>
              <Select
                value={courseForm.category || "none"}
                onValueChange={(v) => setCourseForm({ ...courseForm, category: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Bez kategorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez kategorie</SelectItem>
                  {COURSE_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Podle kategorie mohou uživatelé kurzy filtrovat.</p>
            </div>


            <div><Label>Pořadí</Label><Input type="number" value={courseForm.sort_order ?? 0} onChange={(e) => setCourseForm({ ...courseForm, sort_order: parseInt(e.target.value) || 0 })} /></div>

            <div className="flex items-center gap-3">
              <Switch checked={!!courseForm.is_published} onCheckedChange={(v) => setCourseForm({ ...courseForm, is_published: v })} />
              <Label>Publikováno</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={!!courseForm.is_accredited} onCheckedChange={(v) => setCourseForm({ ...courseForm, is_accredited: v })} />
              <Label>Akreditováno DVPP</Label>
            </div>
            {courseForm.is_accredited && (
              <div><Label>Číslo akreditace</Label><Input value={courseForm.accreditation_number || ""} onChange={(e) => setCourseForm({ ...courseForm, accreditation_number: e.target.value })} /></div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={!!courseForm.issues_certificate} onCheckedChange={(v) => setCourseForm({ ...courseForm, issues_certificate: v })} />
              <Label>Vydává certifikát po dokončení</Label>
            </div>

            {courseForm.issues_certificate && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!courseForm.requires_evidence}
                    onCheckedChange={(v) => setCourseForm({ ...courseForm, requires_evidence: v })}
                  />
                  <Label>Vyžaduje důkaz z praxe</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pokud je zapnuté, certifikát se po dokončení modulů nevydá automaticky. Učitel odevzdá popis (a volitelně přílohu) z vlastní výuky, a certifikát se vydá až po schválení admin recenzentem.
                </p>
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">Monetizace (zatím koncepčně – platby se ještě nevybírají).</p>
              <div>
                <Label>Cena (Kč)</Label>
                <Input type="number" min={0} step="0.01" placeholder="Prázdné = zdarma" value={courseForm.price ?? ""} onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Typ příjmu</Label>
                <Select value={courseForm.revenue_type || "__none__"} onValueChange={(v) => setCourseForm({ ...courseForm, revenue_type: v === "__none__" ? null : (v as RevenueType) })}>
                  <SelectTrigger><SelectValue placeholder="Neuvedeno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Neuvedeno</SelectItem>
                    <SelectItem value="Bezli">Bezli (vlastní kurz)</SelectItem>
                    <SelectItem value="creator_share">Externí tvůrce (podíl)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {courseForm.revenue_type === "creator_share" && (
                <>
                  <div>
                    <Label>ID tvůrce (uuid z profiles)</Label>
                    <Input value={courseForm.creator_id || ""} onChange={(e) => setCourseForm({ ...courseForm, creator_id: e.target.value || null })} />
                  </div>
                  <div>
                    <Label>Provize platformy (%)</Label>
                    <Input type="number" min={0} max={100} step="0.1" value={courseForm.platform_commission_percent ?? ""} onChange={(e) => setCourseForm({ ...courseForm, platform_commission_percent: e.target.value === "" ? null : Number(e.target.value) })} />
                    <p className="text-xs text-muted-foreground mt-1">Zamkne se v okamžiku publikace – nemění se zpětně při změně globální sazby.</p>
                  </div>
                </>
              )}
            </div>

            <Button onClick={saveCourse} className="w-full">Uložit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyCoursesManager;
