import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft, Award } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_accredited: boolean;
  accreditation_number: string | null;
  is_published: boolean;
  sort_order: number;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  sort_order: number;
}

const AcademyCoursesManager = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  const [courseDlgOpen, setCourseDlgOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<Partial<Course>>({});

  const [moduleDlgOpen, setModuleDlgOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState<Partial<Module>>({});

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("academy_courses").select("*").order("sort_order", { ascending: true });
    setCourses((data || []) as Course[]);
    setLoading(false);
  }, []);

  const fetchModules = useCallback(async (courseId: string) => {
    const { data } = await supabase
      .from("academy_modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });
    setModules((data || []) as Module[]);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (selectedCourse) fetchModules(selectedCourse.id);
  }, [selectedCourse, fetchModules]);

  const openNewCourse = () => {
    setCourseForm({ title: "", description: "", is_published: false, is_accredited: false, sort_order: courses.length });
    setCourseDlgOpen(true);
  };
  const openEditCourse = (c: Course) => {
    setCourseForm(c);
    setCourseDlgOpen(true);
  };
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
    fetchCourses();
  };
  const deleteCourse = async (id: string) => {
    if (!confirm("Smazat kurz včetně všech modulů?")) return;
    const { error } = await supabase.from("academy_courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    fetchCourses();
    if (selectedCourse?.id === id) setSelectedCourse(null);
  };

  const openNewModule = () => {
    if (!selectedCourse) return;
    setModuleForm({ course_id: selectedCourse.id, title: "", content: "", sort_order: modules.length });
    setModuleDlgOpen(true);
  };
  const openEditModule = (m: Module) => {
    setModuleForm(m);
    setModuleDlgOpen(true);
  };
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
    setModuleDlgOpen(false);
    toast.success("Uloženo");
    if (selectedCourse) fetchModules(selectedCourse.id);
  };
  const deleteModule = async (id: string) => {
    if (!confirm("Smazat modul?")) return;
    const { error } = await supabase.from("academy_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    if (selectedCourse) fetchModules(selectedCourse.id);
  };

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
          <Button size="sm" onClick={openNewModule}>
            <Plus className="w-4 h-4 mr-1" /> Nový modul
          </Button>
        </div>

        <div className="space-y-2">
          {modules.map((m, i) => (
            <Card key={m.id} className="p-3 flex items-center gap-3">
              <div className="text-sm text-muted-foreground w-8 text-center">{i + 1}</div>
              <div className="flex-1">
                <div className="font-medium">{m.title}</div>
                {m.video_url && <div className="text-xs text-muted-foreground">🎥 {m.video_url}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEditModule(m)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteModule(m.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
          {modules.length === 0 && <p className="text-sm text-muted-foreground">Žádné moduly.</p>}
        </div>

        <Sheet open={moduleDlgOpen} onOpenChange={setModuleDlgOpen}>
          <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{moduleForm.id ? "Upravit modul" : "Nový modul"}</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 mt-4">
              <div>
                <Label>Název</Label>
                <Input value={moduleForm.title || ""} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} />
              </div>
              <div>
                <Label>Pořadí</Label>
                <Input
                  type="number"
                  value={moduleForm.sort_order ?? 0}
                  onChange={(e) => setModuleForm({ ...moduleForm, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Video URL (volitelné – embed odkaz)</Label>
                <Input value={moduleForm.video_url || ""} onChange={(e) => setModuleForm({ ...moduleForm, video_url: e.target.value })} />
              </div>
              <div>
                <Label>Obsah (podporuje ## nadpisy)</Label>
                <Textarea
                  rows={16}
                  value={moduleForm.content || ""}
                  onChange={(e) => setModuleForm({ ...moduleForm, content: e.target.value })}
                />
              </div>
              <Button onClick={saveModule} className="w-full">Uložit</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">ZEdu Akademie – kurzy</h2>
          <p className="text-sm text-muted-foreground">Správa kurzů a modulů pro učitele.</p>
        </div>
        <Button onClick={openNewCourse}>
          <Plus className="w-4 h-4 mr-1" /> Nový kurz
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Načítání…</p>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.title}</span>
                  {c.is_published ? (
                    <Badge variant="default">Publikováno</Badge>
                  ) : (
                    <Badge variant="secondary">Koncept</Badge>
                  )}
                  {c.is_accredited && (
                    <Badge variant="outline" className="gap-1">
                      <Award className="w-3 h-3" /> DVPP
                    </Badge>
                  )}
                </div>
                {c.description && <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelectedCourse(c)}>
                Moduly
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openEditCourse(c)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteCourse(c.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
          {courses.length === 0 && <p className="text-sm text-muted-foreground">Žádné kurzy.</p>}
        </div>
      )}

      <Dialog open={courseDlgOpen} onOpenChange={setCourseDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{courseForm.id ? "Upravit kurz" : "Nový kurz"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název</Label>
              <Input value={courseForm.title || ""} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea rows={3} value={courseForm.description || ""} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
            </div>
            <div>
              <Label>URL obálky (obrázek)</Label>
              <Input value={courseForm.cover_image_url || ""} onChange={(e) => setCourseForm({ ...courseForm, cover_image_url: e.target.value })} />
            </div>
            <div>
              <Label>Pořadí</Label>
              <Input
                type="number"
                value={courseForm.sort_order ?? 0}
                onChange={(e) => setCourseForm({ ...courseForm, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!!courseForm.is_published}
                onCheckedChange={(v) => setCourseForm({ ...courseForm, is_published: v })}
              />
              <Label>Publikováno</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!!courseForm.is_accredited}
                onCheckedChange={(v) => setCourseForm({ ...courseForm, is_accredited: v })}
              />
              <Label>Akreditováno DVPP</Label>
            </div>
            {courseForm.is_accredited && (
              <div>
                <Label>Číslo akreditace</Label>
                <Input value={courseForm.accreditation_number || ""} onChange={(e) => setCourseForm({ ...courseForm, accreditation_number: e.target.value })} />
              </div>
            )}
            <Button onClick={saveCourse} className="w-full">Uložit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyCoursesManager;
