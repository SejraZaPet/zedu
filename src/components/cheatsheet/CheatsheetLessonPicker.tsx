import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPracticeLessons } from "@/hooks/useStudentPracticeLessons";
import { blocksToPlainText } from "@/lib/lesson-study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesSearch } from "@/lib/picker-search";
import { toast } from "sonner";
import type { CheatsheetSource } from "./CheatsheetEditor";

export default function CheatsheetLessonPicker({ onSelect }: { onSelect: (source: CheatsheetSource) => void }) {
  const { user } = useAuth();
  const lessonsQuery = useStudentPracticeLessons(user?.id);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const lessons = (lessonsQuery.data ?? []).flatMap((group) => group.lessons).filter((lesson) => matchesSearch(query, lesson.title, lesson.subject, lesson.textbook));

  return <div className="space-y-2"><Input aria-label="Hledat lekci" placeholder="Hledat lekci" value={query} onChange={(event) => setQuery(event.target.value)} />{lessonsQuery.isPending ? <p role="status">Načítání lekcí…</p> : lessonsQuery.isError ? <div role="alert" className="space-y-2"><p>Lekce se nepodařilo načíst</p><Button type="button" variant="outline" className="min-h-11" disabled={lessonsQuery.isFetching} onClick={() => { void lessonsQuery.refetch(); }}>Zkusit znovu</Button></div> : !lessons.length ? <p className="text-sm text-muted-foreground">Žádné dostupné lekce.</p> : <ul className="max-h-48 overflow-y-auto space-y-1">{lessons.map((lesson) => <li key={lesson.id}><Button disabled={busy} variant="ghost" className="min-h-11 h-auto w-full justify-start whitespace-normal text-left" onClick={async () => {
    setBusy(true);
    try {
      const [teacher, global] = await Promise.all([
        supabase.from("teacher_textbook_lessons").select("title, blocks").eq("id", lesson.id).eq("status", "published").maybeSingle(),
        supabase.from("textbook_lessons").select("title, blocks").eq("id", lesson.id).eq("status", "published").maybeSingle(),
      ]);
      const selectedLesson = teacher.data ?? global.data;
      if (!selectedLesson) throw new Error("unavailable");
      const text = blocksToPlainText(selectedLesson.blocks, 50000);
      if (!text.trim()) { toast.info("Lekce nemá text k vložení."); return; }
      onSelect({ title: selectedLesson.title, text, subject: lesson.subject });
    } catch { toast.error("Text lekce není dostupný. Zkus jinou lekci."); } finally { setBusy(false); }
  }}><span className="min-w-0 break-words">{lesson.title}<span className="block text-xs text-muted-foreground">{lesson.subject} · {lesson.textbook}</span></span></Button></li>)}</ul>}</div>;
}
