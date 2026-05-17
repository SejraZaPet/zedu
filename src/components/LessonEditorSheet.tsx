import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Block } from "@/lib/textbook-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlockEditor from "@/components/admin/BlockEditor";
import LessonAssignments, { type Assignment } from "@/components/admin/LessonAssignments";
import LessonPlanGenerator from "@/components/admin/LessonPlanGenerator";
import { Save, Upload, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface LessonData {
  id: string;
  title: string;
  hero_image_url: string | null;
  status: string;
  blocks: Block[];
  sort_order: number;
  topic_id: string;
  require_activities: boolean;
  scheduled_publish_at: string | null;
}

// Convert ISO/UTC string -> value usable by <input type="datetime-local">
const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (s: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const LessonEditorSheet = ({ lessonId, open, onOpenChange, onSaved }: Props) => {
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);

  const fetchLesson = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    const { data } = await supabase
      .from("textbook_lessons")
      .select("*")
      .eq("id", lessonId)
      .single();

    if (data) {
      setLesson({
        ...data,
        blocks: ((data as any).blocks as unknown as Block[]) ?? [],
        require_activities: (data as any).require_activities ?? false,
      } as LessonData);
    }
    setLoading(false);
  }, [lessonId]);

  const loadAssignments = useCallback(async () => {
    const { data } = await supabase
      .from("lesson_topic_assignments")
      .select("id, topic_id, sort_order, textbook_topics(id, title, subject, grade)")
      .eq("lesson_id", lessonId);

    if (data) {
      setAssignments(data.map((row: any) => ({
        id: row.id,
        topic_id: row.topic_id,
        subject: row.textbook_topics?.subject ?? "",
        grade: row.textbook_topics?.grade ?? 1,
        topic_title: row.textbook_topics?.title ?? "",
        sort_order: row.sort_order,
      })));
    }
  }, [lessonId]);

  useEffect(() => {
    if (open && lessonId) {
      fetchLesson();
      loadAssignments();
    }
  }, [open, lessonId, fetchLesson, loadAssignments]);

  const saveLesson = async () => {
    if (!lesson) return;

    const validAssignments = assignments.filter((a) => a.topic_id);
    if (validAssignments.length === 0) {
      toast({ title: "Chyba", description: "Lekce musí mít alespoň jedno umístění.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const primaryTopicId = validAssignments[0].topic_id;

    const payload = {
      topic_id: primaryTopicId,
      title: lesson.title,
      hero_image_url: lesson.hero_image_url,
      status: lesson.status,
      blocks: lesson.blocks as any,
      sort_order: lesson.sort_order,
      require_activities: lesson.require_activities,
    };

    await supabase.from("textbook_lessons").update(payload).eq("id", lesson.id);

    // Sync assignments
    await supabase.from("lesson_topic_assignments").delete().eq("lesson_id", lesson.id);
    if (validAssignments.length > 0) {
      await supabase.from("lesson_topic_assignments").insert(
        validAssignments.map((a, i) => ({
          lesson_id: lesson.id,
          topic_id: a.topic_id,
          sort_order: i,
        }))
      );
    }

    setSaving(false);
    toast({ title: "Změny uloženy", description: "Lekce byla úspěšně aktualizována." });
    onSaved();
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!lesson) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    const ext = file.name.split(".").pop();
    const path = `hero/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setLesson({ ...lesson, hero_image_url: data.publicUrl });
    }
    setHeroUploading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upravit lekci</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Načítám…</span>
          </div>
        ) : !lesson ? (
          <p className="text-muted-foreground py-8">Lekce nenalezena.</p>
        ) : (
          <Tabs defaultValue="content" className="mt-4">
            <TabsList className="mb-4">
              <TabsTrigger value="content">Obsah</TabsTrigger>
              <TabsTrigger value="plan" className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Plán lekce
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Název lekce</Label>
                  <Input value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Stav</Label>
                  <Select value={lesson.status} onValueChange={(v) => setLesson({ ...lesson, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Koncept</SelectItem>
                      <SelectItem value="published">Publikováno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hero obrázek</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={lesson.hero_image_url ?? ""}
                      onChange={(e) => setLesson({ ...lesson, hero_image_url: e.target.value })}
                      placeholder="URL…"
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" className="relative" disabled={heroUploading}>
                      <Upload className="w-4 h-4 mr-1" />{heroUploading ? "…" : "Nahrát"}
                      <input type="file" accept="image/*" onChange={handleHeroUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </Button>
                  </div>
                  {lesson.hero_image_url && (
                    <img src={lesson.hero_image_url} alt="" className="mt-2 max-h-20 rounded border border-border" />
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <LessonAssignments
                  lessonId={lesson.id}
                  assignments={assignments}
                  onChange={setAssignments}
                />
              </div>

              <div className="flex items-start gap-2 p-3 border border-border rounded-md bg-muted/30">
                <Checkbox
                  id="require_activities"
                  checked={lesson.require_activities}
                  onCheckedChange={(v) => setLesson({ ...lesson, require_activities: !!v })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="require_activities" className="cursor-pointer text-sm font-medium">
                    Vyžadovat splnění aktivit před dokončením
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Student bude moci lekci označit jako dokončenou až po splnění alespoň jedné aktivity.
                  </p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Obsah lekce</Label>
                <BlockEditor
                  blocks={lesson.blocks}
                  onChange={(blocks) => setLesson({ ...lesson, blocks })}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-border sticky bottom-0 bg-background pb-4">
                <Button size="sm" onClick={saveLesson} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Uložit změny
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Zavřít</Button>
              </div>
            </TabsContent>

            <TabsContent value="plan">
              <LessonPlanGenerator
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                lessonBlocks={lesson.blocks}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default LessonEditorSheet;
