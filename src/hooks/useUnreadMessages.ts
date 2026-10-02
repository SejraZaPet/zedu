import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const db = supabase as any;
export const MESSAGES_READ_EVENT = "bezli:messages-read";

/** Počet nepřečtených zpráv od ostatních (podle conversation_participants.last_read_at), živě přes Realtime. */
export function useUnreadMessages() {
  const { user } = useAuth();
  const uid = user?.id;
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!uid) { setCount(0); return; }
    const { data: parts } = await db.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id", uid);
    if (!parts?.length) { setCount(0); return; }
    const readMap: Record<string, string | null> = {};
    parts.forEach((p: any) => { readMap[p.conversation_id] = p.last_read_at; });
    const { data: msgs } = await db.from("messages").select("conversation_id,created_at,sender_id")
      .in("conversation_id", Object.keys(readMap)).neq("sender_id", uid)
      .order("created_at", { ascending: false }).limit(500);
    setCount((msgs ?? []).filter((m: any) => {
      const r = readMap[m.conversation_id];
      return !r || new Date(m.created_at) > new Date(r);
    }).length);
  }, [uid]);

  useEffect(() => {
    if (!uid) { setCount(0); return; }
    load();
    const ch = supabase.channel(`unread-msgs-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${uid}` }, () => load())
      .subscribe();
    const onRead = () => load();
    window.addEventListener(MESSAGES_READ_EVENT, onRead);
    return () => { supabase.removeChannel(ch); window.removeEventListener(MESSAGES_READ_EVENT, onRead); };
  }, [uid, load]);

  return count;
}
