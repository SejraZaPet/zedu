import { useRef, useState } from "react";
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
  textbookId?: string;
  hero_image_url?: string | null;
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

  // Párování uložených a nově vygenerovaných snímků a ochrana ručních úprav
  // řeší sdílený modul `presentation-merge` (má vlastní testy).



  /**
   * Uložená prezentace lekce v `teacher_presentations` (jediný seznam
   * „Prezentace“ učitele). Vzniká i při spuštění z lekce, aby ji učitel
   * v seznamu viděl a mohl ji otevřít v editoru.
   */
  const savePresentationRow = async (lesson: LessonItem, slides: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const isTeacherLesson = lesson.source === "teacher_textbook_lessons";
    const { data: existing } = await supabase
      .from("teacher_presentations" as any)
      .select("id")
      .eq("teacher_id", user.id)
      .eq("source_lesson_id", lesson.id)
      .maybeSingle();

    if ((existing as any)?.id) {
      await supabase
        .from("teacher_presentations" as any)
        .update({ title: lesson.title, slides: slides as any, updated_at: new Date().toISOString() })
        .eq("id", (existing as any).id);
      return (existing as any).id as string;
    }

    const { data: created } = await supabase
      .from("teacher_presentations" as any)
      .insert({
        teacher_id: user.id,
        title: lesson.title,
        slides: slides as any,
        source_lesson_id: lesson.id,
        source_lesson_type: isTeacherLesson ? "teacher" : "global",
        ...(isTeacherLesson ? { lesson_id: lesson.id } : {}),
      } as any)
      .select("id")
      .maybeSingle();
    return ((created as any)?.id as string) ?? null;
  };


  /**
   * Prezentace propojená s lekcí je čistě promítací režim lekce: snímky se
   * VŽDY generují čerstvě z aktuálního obsahu lekce. Uložené kopie v
   * teacher_presentations se nepoužívají (zůstávají jako archiv/historie).
   */
  const buildSlidesForLesson = async (lesson: LessonItem): Promise<any[]> => {
    return blocksToSlides(lesson.blocks || [], lesson.title, { heroImageUrl: lesson.hero_image_url });
  };



  const openEditor = async (lesson: LessonItem) => {
    const slides = await buildSlidesForLesson(lesson);
    setHasSavedPresentation(false);
    setPendingSlides(slides);
    setPresentationLesson(lesson);
    setEditingSlideIndex(0);
  };

  /** Okno projektoru otevřené přímo při kliknutí (kvůli blokování pop-upů). */
  const projectorWindowRef = useRef<Window | null>(null);

  const showProjector = (sessionId: string) => {
    const url = `${window.location.origin}/live/projektor/${sessionId}`;
    const win = projectorWindowRef.current;
    projectorWindowRef.current = null;
    if (win && !win.closed) {
      win.location.href = url;
      return;
    }
    window.open(url, "_blank");
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
          const slides = prebuiltSlides || blocksToSlides(lesson.blocks || [], lesson.title, { heroImageUrl: lesson.hero_image_url });
          // Jediné rozhodnutí, které necháváme na učiteli.
          const win = projectorWindowRef.current;
          if (win && !win.closed) win.close();
          projectorWindowRef.current = null;
          setExistingSession(existing);
          setPendingLaunchData({ lesson, slides });
          return;
        }

      }
      const rawBlocks = lesson.blocks || [];
      const slides = prebuiltSlides || blocksToSlides(rawBlocks, lesson.title, { heroImageUrl: lesson.hero_image_url });
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
      // Propojená prezentace je promítací režim lekce – do teacher_presentations
      // se neukládá; snímky žijí na lekci a v živé relaci.
      toast({ title: "Prezentace spuštěna", description: `Kód: ${gameCode}` });
      showProjector(data.id);
      navigate(`/live/ucitel/${data.id}`);
    } catch (e: any) {
      const win = projectorWindowRef.current;
      if (win && !win.closed) win.close();
      projectorWindowRef.current = null;
      toast({ title: "Chyba", description: e?.message || "Nepodařilo se spustit prezentaci", variant: "destructive" });
    }
  };

  /**
   * FÁZE 3 – „Spustit prezentaci“ jedním klikem: snímky se tiše vygenerují
   * (nebo aktualizují) z obsahu lekce, rovnou vznikne relace a otevře se
   * projektor. Ptáme se jen na běžící starší relaci.
   */
  const quickLaunch = async (lesson: LessonItem) => {
    // Okno musí vzniknout v přímé reakci na klik, jinak ho prohlížeč zablokuje.
    projectorWindowRef.current = window.open("", "_blank");
    try {
      const slides = await buildSlidesForLesson(lesson);
      await launchLiveSession(lesson, slides);
    } catch (e: any) {
      const win = projectorWindowRef.current;
      if (win && !win.closed) win.close();
      projectorWindowRef.current = null;
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
      showProjector(newSession.id);
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
    openEditor, launchLiveSession, launchNew, quickLaunch, showProjector,
    savePresentationRow, buildSlidesForLesson,


  };
}
