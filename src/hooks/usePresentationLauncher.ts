import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { useToast } from "@/hooks/use-toast";

export interface LessonItem {
  id: string;
  title: string;
  sort_order: number;
  status: string;
  blocks: any[];
  source: "textbook_lessons" | "teacher_textbook_lessons";
  topic_id?: string;
}

export function usePresentationLauncher() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [presentationLesson, setPresentationLesson] = useState<LessonItem | null>(null);
  const [pendingSlides, setPendingSlides] = useState<any[]>([]);
  const [editingSlideIndex, setEditingSlideIndex] = useState(0);
  const [existingSession, setExistingSession] = useState<{ id: string; title: string } | null>(null);
  const [pendingLaunchData, setPendingLaunchData] = useState<{ lesson: LessonItem; slides: any[] } | null>(null);

  const [hasSavedPresentation, setHasSavedPresentation] = useState(false);

  const openEditor = async (lesson: LessonItem) => {
    let slides: any[] = [];
    let saved = false;

    const table = lesson.source === "teacher_textbook_lessons"
      ? "teacher_textbook_lessons"
      : "textbook_lessons";

    const { data } = await supabase
      .from(table)
      .select("presentation_slides" as any)
      .eq("id", lesson.id)
      .single();

    const savedSlides = (data as any)?.presentation_slides;
    if (savedSlides && Array.isArray(savedSlides) && savedSlides.length > 0) {
      slides = savedSlides;
      saved = true;
    } else {
      slides = blocksToSlides(lesson.blocks || [], lesson.title);
    }

    setHasSavedPresentation(saved);
    setPendingSlides(slides);
    setPresentationLesson(lesson);
    setEditingSlideIndex(0);
  };

  const launchLiveSession = async (lesson: LessonItem, prebuiltSlides?: any[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: existing } = await supabase
          .from("game_sessions")
          .select("id, title, status")
          .eq("teacher_id", session.user.id)
          .eq("title", lesson.title)
          .in("status", ["lobby", "playing"])
          .maybeSingle();
        if (existing) {
          const slides = prebuiltSlides || blocksToSlides(lesson.blocks || [], lesson.title);
          setExistingSession(existing);
          setPendingLaunchData({ lesson, slides });
          return;
        }
      }
      const rawBlocks = lesson.blocks || [];
      const slides = prebuiltSlides || blocksToSlides(rawBlocks, lesson.title);
      if (!session?.user) throw new Error("Není přihlášen");
      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase.from("game_sessions").insert({
        teacher_id: session.user.id,
        title: lesson.title,
        game_code: gameCode,
        activity_data: slides as any,
        settings: { timePerQuestion: 30, shuffleQuestions: false, shuffleAnswers: false, showLeaderboardAfterEach: false },
        status: "lobby",
        current_question_index: -1,
      }).select().single();
      if (error) throw error;
      if (!data?.id) throw new Error("Chybí ID session");
      const lessonTable = lesson.source === "teacher_textbook_lessons"
        ? "teacher_textbook_lessons"
        : "textbook_lessons";
      await supabase
        .from(lessonTable)
        .update({ presentation_slides: slides } as any)
        .eq("id", lesson.id);
      toast({ title: "Prezentace spuštěna", description: `Kód: ${gameCode}` });
      navigate(`/live/ucitel/${data.id}`);
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message || "Nepodařilo se spustit prezentaci", variant: "destructive" });
    }
  };

  const launchNew = async () => {
    const data = pendingLaunchData;
    setExistingSession(null);
    setPendingLaunchData(null);
    if (!data) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: newSession, error } = await supabase.from("game_sessions").insert({
      teacher_id: session.user.id,
      title: data.lesson.title,
      game_code: gameCode,
      activity_data: data.slides as any,
      settings: { timePerQuestion: 30, shuffleQuestions: false, shuffleAnswers: false, showLeaderboardAfterEach: false },
      status: "lobby",
      current_question_index: -1,
    }).select().single();
    if (!error && newSession?.id) {
      navigate(`/live/ucitel/${newSession.id}`);
    }
  };

  return {
    presentationLesson, setPresentationLesson,
    pendingSlides, setPendingSlides,
    editingSlideIndex, setEditingSlideIndex,
    existingSession, setExistingSession,
    pendingLaunchData, setPendingLaunchData,
    hasSavedPresentation,
    openEditor, launchLiveSession, launchNew,
  };
}
