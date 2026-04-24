import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ChevronRight, Pencil, Trash2, Plus, FileText, Play, Monitor } from "lucide-react";
import LessonPreviewDialog from "@/components/admin/LessonPreviewDialog";
import type { Block } from "@/lib/textbook-config";

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
  onOpenWorksheet: (lessonId: string, lessonTitle: string) => void;
  onPreviewLesson: (lesson: LessonItem) => void;
}

const TextbookGradeGroups = ({
  gradeGroups,
  onEditLesson,
  onDeleteLesson,
  onAddLesson,
  onEditTopic,
  onDeleteTopic,
  onOpenPresentation,
  onOpenWorksheet,
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
                  <div className="border-t border-border divide-y divide-border">
                    {topic.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center gap-2 px-3 py-2 text-sm group hover:bg-muted/10 transition-colors">
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
                        <div className="flex gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditLesson(lesson)} title="Upravit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <LessonPreviewDialog title={lesson.title} heroImageUrl={null} blocks={lesson.blocks} />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5"
                            onClick={() => onOpenWorksheet(lesson.id, lesson.title)}
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
                    ))}
                  </div>
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
