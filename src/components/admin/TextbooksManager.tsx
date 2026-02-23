import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, getGradesForSubject, type Block } from "@/lib/textbook-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import BlockEditor from "./BlockEditor";
import LessonAssignments, { type Assignment } from "./LessonAssignments";
import {
  Plus, Pencil, Trash2, X, Save, ArrowLeft, Upload, GripVertical,
} from "lucide-react";
import LessonPreviewDialog from "./LessonPreviewDialog";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Topic {
  id: string;
  subject: string;
  grade: number;
  title: string;
  sort_order: number;
}

interface Lesson {
  id: string;
  topic_id: string;
  title: string;
  hero_image_url: string | null;
  status: string;
  blocks: Block[];
  sort_order: number;
}

// === Sortable Lesson Row ===
const SortableLessonRow = ({ lesson, onEdit, onDelete }: { lesson: Lesson; onEdit: () => void; onDelete: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border border-border rounded-lg p-3 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground"><GripVertical className="w-4 h-4" /></button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{lesson.title || "Bez názvu"}</p>
      </div>
      <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
        {lesson.status === "published" ? "Publikováno" : "Koncept"}
      </Badge>
      <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
      <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>
    </div>
  );
};

// === Main Component ===
const TextbooksManager = () => {
  const [subject, setSubject] = useState<string>(SUBJECTS[0].id);
  const [grade, setGrade] = useState<number>(1);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [editingTopic, setEditingTopic] = useState<Partial<Topic> | null>(null);
  const [isNewTopic, setIsNewTopic] = useState(false);

  // Lesson state
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isNewLesson, setIsNewLesson] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const grades = getGradesForSubject(subject);

  // Reset grade when subject changes
  useEffect(() => {
    const available = getGradesForSubject(subject);
    if (!available.includes(grade)) setGrade(available[0]);
  }, [subject]);

  // Fetch topics
  const fetchTopics = useCallback(async () => {
    const { data } = await supabase
      .from("textbook_topics")
      .select("*")
      .eq("subject", subject)
      .eq("grade", grade)
      .order("sort_order");
    if (data) setTopics(data as Topic[]);
  }, [subject, grade]);

  useEffect(() => { fetchTopics(); setSelectedTopic(null); }, [fetchTopics]);

  // Fetch lessons for a topic via junction table
  const fetchLessons = useCallback(async () => {
    if (!selectedTopic) return;
    const { data: assignmentRows } = await supabase
      .from("lesson_topic_assignments")
      .select("lesson_id, sort_order")
      .eq("topic_id", selectedTopic.id)
      .order("sort_order");

    if (!assignmentRows || assignmentRows.length === 0) {
      setLessons([]);
      return;
    }

    const lessonIds = assignmentRows.map((a: any) => a.lesson_id);
    const { data: lessonRows } = await supabase
      .from("textbook_lessons")
      .select("*")
      .in("id", lessonIds);

    if (lessonRows) {
      // Sort by assignment sort_order
      const orderMap = new Map(assignmentRows.map((a: any) => [a.lesson_id, a.sort_order]));
      const sorted = lessonRows
        .map((d: any) => ({ ...d, blocks: (d.blocks as Block[]) || [], sort_order: orderMap.get(d.id) ?? 0 }))
        .sort((a, b) => a.sort_order - b.sort_order);
      setLessons(sorted);
    }
  }, [selectedTopic]);

  useEffect(() => { if (selectedTopic) fetchLessons(); }, [fetchLessons, selectedTopic]);

  // Load assignments when editing a lesson
  const loadAssignments = useCallback(async (lessonId: string) => {
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
  }, []);

  // === Topic CRUD ===
  const saveTopic = async () => {
    if (!editingTopic?.title) return;
    if (isNewTopic) {
      await supabase.from("textbook_topics").insert({
        subject, grade, title: editingTopic.title, sort_order: topics.length,
      });
    } else {
      await supabase.from("textbook_topics").update({ title: editingTopic.title }).eq("id", editingTopic.id!);
    }
    setEditingTopic(null);
    setIsNewTopic(false);
    fetchTopics();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Smazat téma i se všemi lekcemi?")) return;
    await supabase.from("textbook_topics").delete().eq("id", id);
    if (selectedTopic?.id === id) setSelectedTopic(null);
    fetchTopics();
  };

  // === Lesson CRUD ===
  const saveLesson = async () => {
    if (!editingLesson) return;

    // Filter valid assignments
    const validAssignments = assignments.filter((a) => a.topic_id);
    if (validAssignments.length === 0) {
      alert("Lekce musí mít alespoň jedno umístění.");
      return;
    }

    const primaryTopicId = validAssignments[0].topic_id;

    const payload = {
      topic_id: primaryTopicId,
      title: editingLesson.title,
      hero_image_url: editingLesson.hero_image_url,
      status: editingLesson.status,
      blocks: editingLesson.blocks as any,
      sort_order: editingLesson.sort_order,
    };

    let lessonId = editingLesson.id;

    if (isNewLesson) {
      const { data } = await supabase.from("textbook_lessons").insert(payload).select("id").single();
      if (data) lessonId = data.id;
    } else {
      await supabase.from("textbook_lessons").update(payload).eq("id", lessonId);
    }

    // Sync assignments: delete old, insert new
    await supabase.from("lesson_topic_assignments").delete().eq("lesson_id", lessonId);
    if (validAssignments.length > 0) {
      await supabase.from("lesson_topic_assignments").insert(
        validAssignments.map((a, i) => ({
          lesson_id: lessonId,
          topic_id: a.topic_id,
          sort_order: i,
        }))
      );
    }

    setEditingLesson(null);
    setIsNewLesson(false);
    fetchLessons();
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Smazat lekci?")) return;
    // Assignments cascade-delete automatically
    await supabase.from("textbook_lessons").delete().eq("id", id);
    fetchLessons();
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingLesson) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    const ext = file.name.split(".").pop();
    const path = `hero/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setEditingLesson({ ...editingLesson, hero_image_url: data.publicUrl });
    }
    setHeroUploading(false);
  };

  // Drag & drop reorder lessons
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleLessonDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedTopic) return;
    const oldIdx = lessons.findIndex((l) => l.id === active.id);
    const newIdx = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIdx, newIdx);
    setLessons(reordered);
    // Update sort_order in junction table
    await Promise.all(reordered.map((l, i) =>
      supabase.from("lesson_topic_assignments")
        .update({ sort_order: i })
        .eq("lesson_id", l.id)
        .eq("topic_id", selectedTopic.id)
    ));
  };

  // === Lesson Editor View ===
  if (editingLesson) {
    const subjectLabel = SUBJECTS.find((s) => s.id === subject)?.label ?? subject;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditingLesson(null); setIsNewLesson(false); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět
          </Button>
          <span className="text-sm text-muted-foreground">{subjectLabel} / {grade}. ročník / {selectedTopic?.title}</span>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Název lekce</Label>
              <Input value={editingLesson.title} onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Stav</Label>
              <Select value={editingLesson.status} onValueChange={(v) => setEditingLesson({ ...editingLesson, status: v })}>
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
                  value={editingLesson.hero_image_url ?? ""}
                  onChange={(e) => setEditingLesson({ ...editingLesson, hero_image_url: e.target.value })}
                  placeholder="URL…"
                  className="flex-1"
                />
                <Button size="sm" variant="outline" className="relative" disabled={heroUploading}>
                  <Upload className="w-4 h-4 mr-1" />{heroUploading ? "…" : "Nahrát"}
                  <input type="file" accept="image/*" onChange={handleHeroUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </Button>
              </div>
              {editingLesson.hero_image_url && (
                <img src={editingLesson.hero_image_url} alt="" className="mt-2 max-h-20 rounded border border-border" />
              )}
            </div>
          </div>

          {/* Assignments section */}
          <div className="border-t border-border pt-4">
            <LessonAssignments
              lessonId={isNewLesson ? null : editingLesson.id}
              assignments={assignments}
              onChange={setAssignments}
            />
          </div>

          <div>
            <Label className="mb-2 block">Obsah lekce</Label>
            <BlockEditor
              blocks={editingLesson.blocks}
              onChange={(blocks) => setEditingLesson({ ...editingLesson, blocks })}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={saveLesson}><Save className="w-4 h-4 mr-1" />Uložit lekci</Button>
            <LessonPreviewDialog
              title={editingLesson.title}
              heroImageUrl={editingLesson.hero_image_url}
              blocks={editingLesson.blocks}
            />
            <Button size="sm" variant="ghost" onClick={() => { setEditingLesson(null); setIsNewLesson(false); }}><X className="w-4 h-4 mr-1" />Zrušit</Button>
          </div>
        </div>
      </div>
    );
  }

  // === Main View ===
  return (
    <div className="space-y-6">
      {/* Subject & Grade selector */}
      <div className="flex gap-3 items-end">
        <div className="w-48">
          <Label className="text-xs">Předmět</Label>
          <Select value={subject} onValueChange={(v) => setSubject(v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Label className="text-xs">Ročník</Label>
          <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {grades.map((g) => (
                <SelectItem key={g} value={String(g)}>{g}. ročník</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Topics panel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-sm text-muted-foreground">Témata</h3>
            <Button size="sm" variant="ghost" onClick={() => { setEditingTopic({ title: "" }); setIsNewTopic(true); }}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {editingTopic && (
            <div className="flex gap-1 mb-2">
              <Input
                value={editingTopic.title ?? ""}
                onChange={(e) => setEditingTopic({ ...editingTopic, title: e.target.value })}
                placeholder="Název tématu…"
                className="text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveTopic()}
              />
              <Button size="icon" variant="ghost" onClick={saveTopic}><Save className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditingTopic(null); setIsNewTopic(false); }}><X className="w-4 h-4" /></Button>
            </div>
          )}

          <div className="space-y-1">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  selectedTopic?.id === topic.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                }`}
                onClick={() => setSelectedTopic(topic)}
              >
                <span className="flex-1 truncate">{topic.title}</span>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                  onClick={(e) => { e.stopPropagation(); setEditingTopic(topic); setIsNewTopic(false); }}
                ><Pencil className="w-3 h-3" /></Button>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteTopic(topic.id); }}
                ><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            ))}
            {topics.length === 0 && !editingTopic && (
              <p className="text-xs text-muted-foreground text-center py-4">Zatím žádná témata.</p>
            )}
          </div>
        </div>

        {/* Lessons panel */}
        <div>
          {selectedTopic ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-sm">Lekce – {selectedTopic.title}</h3>
                <Button
                  size="sm"
                  onClick={() => {
                    setAssignments([{
                      topic_id: selectedTopic.id,
                      subject,
                      grade,
                      topic_title: selectedTopic.title,
                      sort_order: 0,
                    }]);
                    setEditingLesson({
                      id: "", topic_id: selectedTopic.id, title: "",
                      hero_image_url: null, status: "draft", blocks: [],
                      sort_order: lessons.length,
                    });
                    setIsNewLesson(true);
                  }}
                ><Plus className="w-4 h-4 mr-1" />Přidat lekci</Button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
                <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {lessons.map((lesson) => (
                      <SortableLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        onEdit={() => {
                          setEditingLesson(lesson);
                          setIsNewLesson(false);
                          loadAssignments(lesson.id);
                        }}
                        onDelete={() => deleteLesson(lesson.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {lessons.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Zatím žádné lekce v tomto tématu.</p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Vyberte téma pro zobrazení lekcí
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextbooksManager;
