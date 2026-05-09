import { supabase } from "@/integrations/supabase/client";

export type PortfolioItemType =
  | "worksheet_result"
  | "project"
  | "reflection"
  | "upload"
  | "achievement";

export interface PortfolioItem {
  id: string;
  student_id: string;
  type: PortfolioItemType;
  title: string;
  description: string | null;
  subject: string | null;
  attachment_url: string | null;
  content_json: Record<string, any>;
  created_at: string;
  // synthetic flag — true for auto-aggregated items not present in DB
  synthetic?: boolean;
}

export interface PortfolioComment {
  id: string;
  item_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export const TYPE_LABEL: Record<PortfolioItemType, string> = {
  worksheet_result: "Pracovní list",
  project: "Projekt",
  reflection: "Reflexe",
  upload: "Nahraný soubor",
  achievement: "Úspěch",
};

const BADGE_LABELS: Record<string, string> = {
  xp_100: "100 XP",
  xp_500: "500 XP",
  xp_1000: "1 000 XP",
  xp_5000: "5 000 XP",
  level_5: "Level 5",
  level_10: "Level 10",
  streak_7: "Týdenní streak",
  streak_30: "Měsíční streak",
};

export function badgeLabel(slug: string): string {
  return BADGE_LABELS[slug] || slug;
}

/** Load full portfolio (manual + auto-derived items) for a student. */
export async function loadFullPortfolio(studentId: string): Promise<PortfolioItem[]> {
  const [manualRes, attemptsRes, badgesRes] = await Promise.all([
    supabase
      .from("student_portfolio_items")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignment_attempts")
      .select("id, assignment_id, score, max_score, submitted_at, status, assignments!inner(title, subject)")
      .eq("student_id", studentId)
      .eq("status", "submitted")
      .not("score", "is", null)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("student_badges")
      .select("id, badge_slug, earned_at")
      .eq("student_id", studentId)
      .order("earned_at", { ascending: false }),
  ]);

  const manual: PortfolioItem[] = (manualRes.data ?? []).map((r: any) => ({
    ...r,
    content_json: r.content_json ?? {},
  }));

  const auto: PortfolioItem[] = [];

  for (const a of (attemptsRes.data ?? []) as any[]) {
    auto.push({
      id: `attempt-${a.id}`,
      student_id: studentId,
      type: "worksheet_result",
      title: a.assignments?.title || "Pracovní list",
      description: null,
      subject: a.assignments?.subject ?? null,
      attachment_url: null,
      content_json: { score: a.score, max_score: a.max_score, attempt_id: a.id },
      created_at: a.submitted_at || new Date().toISOString(),
      synthetic: true,
    });
  }

  for (const b of (badgesRes.data ?? []) as any[]) {
    auto.push({
      id: `badge-${b.id}`,
      student_id: studentId,
      type: "achievement",
      title: badgeLabel(b.badge_slug),
      description: "Získaný odznak",
      subject: null,
      attachment_url: null,
      content_json: { badge_slug: b.badge_slug },
      created_at: b.earned_at,
      synthetic: true,
    });
  }

  return [...manual, ...auto].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function uploadPortfolioAttachment(studentId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${studentId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("student-portfolio")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Returns a short-lived signed URL for an attachment path. */
export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("student-portfolio")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
