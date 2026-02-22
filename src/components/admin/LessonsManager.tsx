import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, getGradesForSubject } from "@/lib/textbook-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Eye, Search, X } from "lucide-react";

interface LessonRow {
  id: string;
  title: string;
  status: string;
  sort_order: number;
  topic_id: string;
  hero_image_url: string | null;
  blocks: any;
  textbook_topics: {
    id: string;
    title: string;
    subject: string;
    grade: number;
  };
}

interface TopicOption {
  id: string;
  title: string;
}

const LessonsManager = () => {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Topics for the topic filter dropdown
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([]);

  const availableGrades = filterSubject !== "all" ? getGradesForSubject(filterSubject) : [];

  // Fetch topics for dropdown when subject+grade change
  useEffect(() => {
    const fetchTopics = async () => {
      if (filterSubject === "all") {
        setTopicOptions([]);
        setFilterTopic("all");
        return;
      }
      let query = supabase.from("textbook_topics").select("id, title").eq("subject", filterSubject).order("sort_order");
      if (filterGrade !== "all") {
        query = query.eq("grade", Number(filterGrade));
      }
      const { data } = await query;
      setTopicOptions(data ?? []);
      setFilterTopic("all");
    };
    fetchTopics();
  }, [filterSubject, filterGrade]);

  // Reset grade when subject changes
  useEffect(() => {
    setFilterGrade("all");
  }, [filterSubject]);

  // Fetch all lessons with topic info
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("textbook_lessons")
      .select("id, title, status, sort_order, topic_id, hero_image_url, blocks, textbook_topics!inner(id, title, subject, grade)")
      .order("sort_order");

    if (filterSubject !== "all") {
      query = query.eq("textbook_topics.subject", filterSubject);
    }
    if (filterGrade !== "all") {
      query = query.eq("textbook_topics.grade", Number(filterGrade));
    }
    if (filterTopic !== "all") {
      query = query.eq("topic_id", filterTopic);
    }
    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data } = await query;
    let results = (data as unknown as LessonRow[]) ?? [];

    // Client-side name search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter((l) => l.title.toLowerCase().includes(q));
    }

    setLessons(results);
    setLoading(false);
  }, [filterSubject, filterGrade, filterTopic, filterStatus, searchQuery]);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  const deleteLesson = async (id: string) => {
    if (!confirm("Opravdu smazat tuto lekci?")) return;
    await supabase.from("textbook_lessons").delete().eq("id", id);
    fetchLessons();
  };

  const getSubjectLabel = (id: string) => SUBJECTS.find((s) => s.id === id)?.label ?? id;

  const clearFilters = () => {
    setFilterSubject("all");
    setFilterGrade("all");
    setFilterTopic("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  const hasFilters = filterSubject !== "all" || filterGrade !== "all" || filterTopic !== "all" || filterStatus !== "all" || searchQuery.trim() !== "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl">Všechny lekce</h2>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Zrušit filtry
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div>
          <Label className="text-xs">Předmět</Label>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {SUBJECTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Ročník</Label>
          <Select value={filterGrade} onValueChange={setFilterGrade} disabled={filterSubject === "all"}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              {availableGrades.map((g) => (
                <SelectItem key={g} value={String(g)}>{g}. ročník</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Téma</Label>
          <Select value={filterTopic} onValueChange={setFilterTopic} disabled={filterSubject === "all"}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna</SelectItem>
              {topicOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Stav</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              <SelectItem value="draft">Koncept</SelectItem>
              <SelectItem value="published">Publikováno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Hledat</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Název lekce…"
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Lessons list */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Načítání…</p>
      ) : lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {hasFilters ? "Žádné lekce pro zvolený filtr." : "Zatím žádné lekce."}
        </p>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{lesson.title || "Bez názvu"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getSubjectLabel(lesson.textbook_topics.subject)} · {lesson.textbook_topics.grade}. ročník · {lesson.textbook_topics.title}
                </p>
              </div>
              <Badge variant={lesson.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                {lesson.status === "published" ? "Publikováno" : "Koncept"}
              </Badge>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => deleteLesson(lesson.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonsManager;
