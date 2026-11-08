import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchStudentPracticeLessons, type PracticeLessonGroup } from "@/lib/student-practice-lessons";
import { blocksToPlainText } from "@/lib/lesson-study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesSearch } from "@/lib/picker-search";
import { toast } from "sonner";
import type { CheatsheetSource } from "./CheatsheetEditor";
export default function CheatsheetLessonPicker({ onSelect }: { onSelect: (source: CheatsheetSource) => void }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<PracticeLessonGroup[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { if (!user) return; let alive = true; fetchStudentPracticeLessons(user.id).then(data => { if (alive) setGroups(data); }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [user?.id]);
  const lessons = groups.flatMap(g => g.lessons).filter(l => matchesSearch(query, l.title, l.subject, l.textbook));
  return <div className="space-y-2"><Input aria-label="Hledat lekci" placeholder="Hledat lekci" value={query} onChange={e => setQuery(e.target.value)} />{loading ? <p role="status">Načítání lekcí…</p> : error ? <p role="alert">Lekce se nepodařilo načíst. Zkus dialog otevřít znovu.</p> : !lessons.length ? <p className="text-sm text-muted-foreground">Žádné dostupné lekce.</p> : <ul className="max-h-48 overflow-y-auto space-y-1">{lessons.map(l => <li key={l.id}><Button disabled={busy} variant="ghost" className="min-h-11 h-auto w-full justify-start whitespace-normal text-left" onClick={async () => {
    setBusy(true);
    try {
      const [teacher, global] = await Promise.all([
        supabase.from("teacher_textbook_lessons").select("title, blocks").eq("id", l.id).eq("status", "published").maybeSingle(),
        supabase.from("textbook_lessons").select("title, blocks").eq("id", l.id).eq("status", "published").maybeSingle(),
      ]);
      const lesson = teacher.data ?? global.data;
      if (!lesson) throw new Error("unavailable");
      const text = blocksToPlainText(lesson.blocks, 50000);
      if (!text.trim()) { toast.info("Lekce nemá text k vložení."); return; }
      onSelect({ title: lesson.title, text, subject: l.subject });
    } catch { toast.error("Text lekce není dostupný. Zkus jinou lekci."); } finally { setBusy(false); }
  }}><span className="min-w-0 break-words">{l.title}<span className="block text-xs text-muted-foreground">{l.subject} · {l.textbook}</span></span></Button></li>)}</ul>}</div>;
}