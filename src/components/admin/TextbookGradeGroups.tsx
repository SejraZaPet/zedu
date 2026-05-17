import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ChevronRight, Pencil, Trash2, Plus, FileText, Play, Monitor, GripVertical } from "lucide-react";
import LessonPreviewDialog from "@/components/admin/LessonPreviewDialog";
import type { Block } from "@/lib/textbook-config";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LessonItem {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: Block[];
  source: "textbook_lessons" | "teacher_textbook_lessons";
  topic_id?: string;
}

interface TopicItem {
  id: string;
  title: string;
  sort_order: number;
  lessons: LessonItem[];
}

interface GradeGroup {
  grade: number;
  label: string;
  topics: TopicItem[];
}

interface Props {
  gradeGroups: GradeGroup[];
  subjects: any[];
  selectedTextbook: { subject: string } | null;
  onEditLesson: (lesson: LessonItem) => void;
  onDeleteLesson: (lesson: LessonItem) => void;
  onAddLesson: (topicId: string) => void;
  onEditTopic: (topic: { id: string; title: string }) => void;
  onDeleteTopic: (topicId: string, lessonCount: number) => void;
  onOpenPresentation: (lesson: LessonItem) => void;
  onOpenWorksheet: (lesson: LessonItem) => void;
  onPreviewLesson: (lesson: LessonItem) => void;
  onReorderLessons?: (topicId: string, orderedLessons: LessonItem[]) => void;
}

const SortableLessonRow = ({
  lesson,
  onEditLesson,
  onDeleteLesson,
  onOpenPresentation,
  onOpenWorksheet,
}: {
  lesson: LessonItem;
  onEditLesson: (l: LessonItem) => void;
  onDeleteLesson: (l: LessonItem) => void;
  onOpenPresentation: (l: LessonItem) => void;
  onOpenWorksheet: (l: LessonItem) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 text-sm group hover:bg-muted/10 transition-colors bg-background"
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Přesunout lekci"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
      <button
        className="flex-1 text-left truncate hover:text-primary transition-colors cursor-pointer"
        onClick={() => onEditLesson(lesson)}
      >
        {lesson.title}
      </button>
      <Badge
        variant={lesson.status === "published" ? "default" : "secondary"}
        className="text-[10px] shrink-0"
      >
        {lesson.status === "published" ? "Pub" : "Konc"}
      </Badge>
      {/* Mobile: icon-only buttons */}
      <div className="flex md:hidden gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEditLesson(lesson)} title="Upravit">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenWorksheet(lesson)} title="Pracovní list">
          <FileText className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenPresentation(lesson)} title="Prezentace">
          <Monitor className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDeleteLesson(lesson)} title="Smazat">
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
      {/* Desktop: buttons with text */}
      <div className="hidden md:flex gap-0.5 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditLesson(lesson)} title="Upravit">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <LessonPreviewDialog title={lesson.title} heroImageUrl={null} blocks={lesson.blocks} />
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={() => onOpenWorksheet(lesson)}
          title="Vytvořit pracovní list"
        >
          <FileText className="w-3.5 h-3.5" />
          Pracovní list
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={() => onOpenPresentation(lesson)}
          title="Spustit jako prezentaci"
        >
          <Play className="w-3.5 h-3.5" />
          Prezentace
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDeleteLesson(lesson)} title="Smazat">
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

const TopicLessonsList = ({
  topic,
  onEditLesson,
  onDeleteLesson,
  onOpenPresentation,
  onOpenWorksheet,
  onReorderLessons,
}: {
  topic: TopicItem;
  onEditLesson: (l: LessonItem) => void;
  onDeleteLesson: (l: LessonItem) => void;
  onOpenPresentation: (l: LessonItem) => void;
  onOpenWorksheet: (l: LessonItem) => void;
  onReorderLessons?: (topicId: string, orderedLessons: LessonItem[]) => void;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = topic.lessons.findIndex((l) => l.id === active.id);
    const newIndex = topic.lessons.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(topic.lessons, oldIndex, newIndex);
    onReorderLessons?.(topic.id, next);
  };

  return (
    <div className="border-t border-border divide-y divide-border">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topic.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {topic.lessons.map((lesson) => (
            <SortableLessonRow
              key={lesson.id}
              lesson={lesson}
              onEditLesson={onEditLesson}
              onDeleteLesson={onDeleteLesson}
              onOpenPresentation={onOpenPresentation}
              onOpenWorksheet={onOpenWorksheet}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

const TextbookGradeGroups = ({
  gradeGroups,
  onEditLesson,
  onDeleteLesson,
  onAddLesson,
  onEditTopic,
  onDeleteTopic,
  onOpenPresentation,
  onOpenWorksheet,
  onReorderLessons,
}: Props) => {
  return (
    <div className="space-y-3">
      {gradeGroups.map((group) => (
        <div key={group.grade} className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 border-b border-border">
            <h4 className="text-sm font-semibold">{group.label}</h4>
          </div>
          <div className="p-2 space-y-2">
            {group.topics.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Žádná témata</p>
            ) : group.topics.map((topic) => (
              <div key={topic.id} className="border border-border rounded-md">
                {/* Topic header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/10">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium flex-1">{topic.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {topic.lessons.length} {topic.lessons.length === 1 ? "lekce" : "lekcí"}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditTopic({ id: topic.id, title: topic.title })}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDeleteTopic(topic.id, topic.lessons.length)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>

                {/* Lessons */}
                {topic.lessons.length > 0 && (
                  <TopicLessonsList
                    topic={topic}
                    onEditLesson={onEditLesson}
                    onDeleteLesson={onDeleteLesson}
                    onOpenPresentation={onOpenPresentation}
                    onOpenWorksheet={onOpenWorksheet}
                    onReorderLessons={onReorderLessons}
                  />
                )}

                {/* Quick add lesson to this topic */}
                <div className="border-t border-border px-3 py-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => onAddLesson(topic.id)}
                  >
                    <Plus className="w-3 h-3" /> Přidat lekci
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TextbookGradeGroups;
