import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LessonSource = "textbook_lessons" | "teacher_textbook_lessons";

export interface LessonHighlight {
  id: string;
  block_id: string;
  selected_text: string;
  note: string | null;
  color: string | null;
}

/** Zvýraznění a poznámky žáka v jedné lekci (vlastní řádky, RLS na user_id). */
export const useLessonHighlights = (lessonId: string | undefined, source: LessonSource) => {
  const [highlights, setHighlights] = useState<LessonHighlight[]>([]);

  const reload = useCallback(async () => {
    if (!lessonId) {
      setHighlights([]);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHighlights([]);
      return;
    }
    const { data } = await supabase
      .from("lesson_highlights")
      .select("id, block_id, selected_text, note, color")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .eq("lesson_source", source);
    setHighlights((data ?? []) as LessonHighlight[]);
  }, [lessonId, source]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addHighlight = useCallback(
    async (blockId: string, selectedText: string, note?: string | null, color = "yellow") => {
      if (!lessonId || !selectedText.trim()) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("lesson_highlights")
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          lesson_source: source,
          block_id: blockId,
          selected_text: selectedText,
          note: note ?? null,
          color,
        })
        .select("id, block_id, selected_text, note, color")
        .single();
      if (error || !data) return null;
      setHighlights((prev) => [...prev, data as LessonHighlight]);
      return data as LessonHighlight;
    },
    [lessonId, source],
  );

  const updateNote = useCallback(async (id: string, note: string) => {
    const { error } = await supabase.from("lesson_highlights").update({ note: note || null }).eq("id", id);
    if (error) return false;
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, note: note || null } : h)));
    return true;
  }, []);

  const removeHighlight = useCallback(async (id: string) => {
    const { error } = await supabase.from("lesson_highlights").delete().eq("id", id);
    if (error) return false;
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    return true;
  }, []);

  return { highlights, addHighlight, updateNote, removeHighlight, reload };
};
