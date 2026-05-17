import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Block } from "@/lib/textbook-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import BlockEditor from "@/components/admin/BlockEditor";
import LessonPreviewDialog from "@/components/admin/LessonPreviewDialog";
import LessonPlacementEditor, { savePlacements, type Placement } from "@/components/admin/LessonPlacementEditor";
import LessonAssignments, { type Assignment } from "@/components/admin/LessonAssignments";
import { Upload, Save, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LessonItem {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
  source: "textbook_lessons" | "teacher_textbook_lessons";
  topic_id?: string;
  hero_image_url?: string | null;
  scheduled_publish_at?: string | null;
  require_activities?: boolean;
}

interface Props {
  lesson: LessonItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const toLocalInput = (iso: string | null | undefined): string => {
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

const TeacherTextbookLessonEditorSheet = ({ lesson, open, onOpenChange, onSaved }: Props) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<LessonItem | null>(lesson);
  const [lessonPlacements, setLessonPlacements] = useState<Placement[]>([]);
  const [lessonAssignments, setLessonAssignments] = useState<Assignment[]>([]);
  const [heroUploading, setHeroUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(lesson ? { ...lesson } : null);
    setLessonPlacements([]);
    setLessonAssignments([]);
  }, [lesson]);

  useEffect(() => {
    if (!open || !lesson || lesson.source !== "textbook_lessons") return;

    const loadAssignments = async () => {
      const { data } = await supabase
        .from("lesson_topic_assignments")
        .select("id, topic_id, sort_order, status, scheduled_publish_at, textbook_topics(id, title, subject, grade)")
        .eq("lesson_id", lesson.id);

      if (data) {
        setLessonAssignments(
          data.map((row: any) => ({
            id: row.id,
            topic_id: row.topic_id,
            subject: row.textbook_topics?.subject ?? "",
            grade: row.textbook_topics?.grade ?? 1,
            topic_title: row.textbook_topics?.title ?? "",
            sort_order: row.sort_order,
            status: row.status ?? "published",
            scheduled_publish_at: row.scheduled_publish_at ?? null,
          })),
        );
      }
    };

    loadAssignments();
  }, [open, lesson]);

  const handleBlocksChange = useCallback((blocks: Block[]) => {
    setDraft((prev) => (prev ? { ...prev, blocks } : prev));
  }, []);

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!draft) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setHeroUploading(true);
    const ext = file.name.split(".").pop();
    const path = `hero/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);

    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setDraft((prev) => (prev ? { ...prev, hero_image_url: data.publicUrl } : prev));
    } else {
      toast({ title: "Nahrání selhalo", description: error.message, variant: "destructive" });
    }

    setHeroUploading(false);
  };

  const saveLessonEdit = async () => {
    if (!draft) return;

    let status = draft.status;
    let scheduledAt = draft.scheduled_publish_at ?? null;
    if (status === "scheduled") {
      if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
        toast({
          title: "Neplatný čas publikování",
          description: "Pro naplánování zvolte datum a čas v budoucnosti.",
          variant: "destructive",
        });
        return;
      }
    } else {
      scheduledAt = null;
    }

    setSaving(true);

    const table = draft.source;
    const payload: any = {
      title: draft.title,
      status,
      blocks: draft.blocks as any,
      hero_image_url: draft.hero_image_url ?? null,
      scheduled_publish_at: scheduledAt,
      ...(table === "textbook_lessons" && typeof draft.require_activities === "boolean"
        ? { require_activities: draft.require_activities }
        : {}),
    };

    const { error } = await supabase.from(table).update(payload).eq("id", draft.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (table === "teacher_textbook_lessons" && lessonPlacements.length > 0) {
      try {
        await savePlacements(draft.id, lessonPlacements);
      } catch (err: any) {
        toast({ title: "Chyba při ukládání umístění", description: err.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    if (table === "textbook_lessons") {
      const valid = lessonAssignments.filter((a) => a.topic_id);
      const badRow = valid.find((a) => a.status === "scheduled" && (!a.scheduled_publish_at || new Date(a.scheduled_publish_at).getTime() <= Date.now()));
      if (badRow) {
        toast({
          title: "Neplatný čas publikování umístění",
          description: `Umístění „${badRow.topic_title}" má naplánovaný čas v minulosti.`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      await supabase.from("lesson_topic_assignments").delete().eq("lesson_id", draft.id);
      if (valid.length > 0) {
        const { error: assignmentError } = await supabase.from("lesson_topic_assignments").insert(
          valid.map((a, i) => ({
            lesson_id: draft.id,
            topic_id: a.topic_id,
            sort_order: i,
            status: a.status ?? "published",
            scheduled_publish_at: a.status === "scheduled" ? a.scheduled_publish_at ?? null : null,
          })),
        );

        if (assignmentError) {
          toast({ title: "Chyba při ukládání umístění", description: assignmentError.message, variant: "destructive" });
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    toast({ title: "Lekce uložena" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upravit lekci</SheetTitle>
        </SheetHeader>

        {draft && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Název lekce</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Stav</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) =>
                    setDraft((prev) => (prev
                      ? {
                          ...prev,
                          status: v,
                          scheduled_publish_at: v === "scheduled" ? prev.scheduled_publish_at : null,
                        }
                      : prev))
                  }
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Koncept</SelectItem>
                    <SelectItem value="scheduled">Naplánováno</SelectItem>
                    <SelectItem value="published">Publikováno</SelectItem>
                  </SelectContent>
                </Select>
                {draft.status === "scheduled" && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Publikovat v</Label>
                    <Input
                      type="datetime-local"
                      value={toLocalInput(draft.scheduled_publish_at)}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, scheduled_publish_at: fromLocalInput(e.target.value) } : prev))
                      }
                      className="mt-1"
                    />
                  </div>
                )}
                {draft.status === "published" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => setDraft((prev) => (prev ? { ...prev, status: "draft", scheduled_publish_at: null } : prev))}
                  >
                    Vrátit do konceptu
                  </Button>
                )}
              </div>
              <div>
                <Label>Hero obrázek (banner)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={draft.hero_image_url ?? ""}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, hero_image_url: e.target.value } : prev))}
                    placeholder="URL…"
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" className="relative" disabled={heroUploading}>
                    <Upload className="w-4 h-4 mr-1" />{heroUploading ? "…" : "Nahrát"}
                    <input type="file" accept="image/*" onChange={handleHeroUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </Button>
                </div>
                {draft.hero_image_url && (
                  <img src={draft.hero_image_url} alt="" className="mt-2 max-h-24 rounded border border-border" />
                )}
              </div>
            </div>

            {draft.source === "teacher_textbook_lessons" && (
              <LessonPlacementEditor
                lessonId={draft.id}
                placements={lessonPlacements}
                onChange={setLessonPlacements}
              />
            )}

            {draft.source === "textbook_lessons" && (
              <div className="border-t border-border pt-4">
                <LessonAssignments
                  lessonId={draft.id}
                  assignments={lessonAssignments}
                  onChange={setLessonAssignments}
                />
              </div>
            )}

            {draft.source === "textbook_lessons" && typeof draft.require_activities === "boolean" && (
              <div className="flex items-start gap-2 p-3 border border-border rounded-md bg-muted/30">
                <Checkbox
                  id={`require_activities-${draft.id}`}
                  checked={draft.require_activities}
                  onCheckedChange={(v) => setDraft((prev) => (prev ? { ...prev, require_activities: !!v } : prev))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor={`require_activities-${draft.id}`} className="cursor-pointer text-sm font-medium">
                    Vyžadovat splnění aktivit před dokončením
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Student bude moci lekci označit jako dokončenou až po splnění alespoň jedné aktivity.
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label className="mb-2 block">Obsah lekce</Label>
              <BlockEditor blocks={draft.blocks} onChange={handleBlocksChange} />
            </div>

            <div className="flex gap-2 pt-2 border-t border-border sticky bottom-0 bg-background pb-4">
              <Button size="sm" onClick={saveLessonEdit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Uložit změny
              </Button>
              <LessonPreviewDialog title={draft.title} heroImageUrl={draft.hero_image_url ?? null} blocks={draft.blocks} />
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-1" /> Zavřít
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TeacherTextbookLessonEditorSheet;