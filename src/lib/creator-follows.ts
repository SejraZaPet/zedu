import { supabase } from "@/integrations/supabase/client";

export interface FollowedCreator {
  creator_id: string;
  followed_at: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
}

async function requireUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Musíte se přihlásit.");
  return session.user.id;
}

export async function followCreator(creatorId: string): Promise<void> {
  const uid = await requireUserId();
  if (uid === creatorId) throw new Error("Nemůžete sledovat sami sebe.");
  const { error } = await supabase
    .from("creator_follows" as any)
    .insert({ follower_id: uid, creator_id: creatorId } as any);
  if (error && (error as any).code !== "23505") throw error;
}

export async function unfollowCreator(creatorId: string): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase
    .from("creator_follows" as any)
    .delete()
    .eq("follower_id", uid)
    .eq("creator_id", creatorId);
  if (error) throw error;
}

export async function listFollowedCreatorIds(): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("creator_follows" as any)
    .select("creator_id")
    .eq("follower_id", session.user.id);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.creator_id as string);
}

export async function listFollowedCreators(): Promise<FollowedCreator[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("creator_follows" as any)
    .select("creator_id, created_at, creator:profiles!creator_follows_creator_id_fkey(first_name,last_name)")
    .eq("follower_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const first = r.creator?.first_name ?? null;
    const last = r.creator?.last_name ?? null;
    const display =
      [first, last].filter(Boolean).join(" ").trim() || "Neznámý autor";
    return {
      creator_id: r.creator_id,
      followed_at: r.created_at,
      first_name: first,
      last_name: last,
      display_name: display,
    };
  });
}

export async function getFollowerCount(creatorId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_follower_count" as any, {
    _creator_id: creatorId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}
