import { subjectKeyFromLabel } from "@/lib/game-backgrounds";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_GAME_SETTINGS, generateGameCode, type TeamMode } from "@/lib/game-types";
import { getModeDef, type GameMode } from "@/lib/game-modes";

export interface GameTemplate {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  purpose: string | null;
  activity_data: any[];
  default_game_mode: string;
  default_team_mode: string;
  subject: string | null;
  curriculum_topic_id: string | null;
  textbook_lesson_id: string | null;
  created_at: string;
  updated_at: string;
}

export const GAME_PURPOSES: { id: string; label: string; emoji: string }[] = [
  { id: "opakovaci", label: "Opakovací", emoji: "🔁" },
  { id: "rozptylova", label: "Rozptylová", emoji: "🎈" },
  { id: "motivacni", label: "Motivační", emoji: "🚀" },
  { id: "aktivizacni", label: "Aktivizační", emoji: "⚡" },
  { id: "jina", label: "Jiná", emoji: "•" },
];

export const purposeLabel = (id?: string | null) =>
  GAME_PURPOSES.find((p) => p.id === id)?.label ?? "Bez účelu";

export async function fetchGameTemplates(): Promise<GameTemplate[]> {
  const { data, error } = await supabase
    .from("teacher_game_templates" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []) as GameTemplate[];
}

/**
 * Creates a live session from a game template. Uses the exact same mechanism as
 * "Spustit prezentaci" (a game_sessions row with activity_data), only the source
 * of the slides is the template. Default game mode / team mode are prefilled
 * from the template and can still be changed in the lobby.
 */
export async function launchTemplateSession(template: GameTemplate): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Nejste přihlášeni.");

  const slides = Array.isArray(template.activity_data) ? template.activity_data : [];
  if (slides.length === 0) throw new Error("Hra neobsahuje žádný obsah.");

  const mode = (template.default_game_mode || "standard") as GameMode;
  const teamKind = (template.default_team_mode || "none") as TeamMode;

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      teacher_id: session.user.id,
      title: template.title,
      game_code: generateGameCode(),
      activity_data: slides as any,
      settings: {
        ...DEFAULT_GAME_SETTINGS,
        gameMode: mode,
        theme: getModeDef(mode).themes[0].id,
        teamModeKind: teamKind,
        teamMode: teamKind !== "none",
        teamCount: 2,
        subjectKey: subjectKeyFromLabel(template.subject),
      } as any,
      status: "lobby",
      current_question_index: -1,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Nepodařilo se vytvořit session.");
  return data.id as string;
}
