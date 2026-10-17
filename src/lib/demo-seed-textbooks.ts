import { supabase } from "@/integrations/supabase/client";

/**
 * Demo učitel nevlastní žádnou učebnici; ukázkové učebnice (is_demo_seed) může
 * jen číst (RLS demo_seed_read, zápis blokuje demo_guard_*). Výběry učebnic
 * proto pro demo účty přidají i ukázkové učebnice. Běžné účty beze změny.
 */
const demoCache = new Map<string, Promise<boolean>>();

export function isDemoAccount(uid: string): Promise<boolean> {
  let p = demoCache.get(uid);
  if (!p) {
    p = (supabase.rpc as any)("get_my_demo_pair")
      .then(({ data }: { data: unknown }) => Array.isArray(data) && data.length > 0)
      .catch(() => false);
    demoCache.set(uid, p);
  }
  return p;
}

/** PostgREST `or` filtr: vlastní učebnice, u dema i ukázkové. */
export function textbookOwnerOr(uid: string, isDemo: boolean): string {
  return isDemo ? `teacher_id.eq.${uid},is_demo_seed.eq.true` : `teacher_id.eq.${uid}`;
}

export async function ownTextbooksOr(uid: string): Promise<string> {
  return textbookOwnerOr(uid, await isDemoAccount(uid));
}
