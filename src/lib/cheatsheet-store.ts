import { supabase } from "@/integrations/supabase/client";
import { CHEATSHEET_STORAGE_MARKER, parseCheatsheet, validCheatsheet, type Cheatsheet, type CheatsheetData } from "./cheatsheet";

async function currentOwner(ownerId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== ownerId) throw new Error("Přihlášení se změnilo. Obnov stránku a zkus to znovu.");
}
export async function loadCheatsheets(ownerId: string): Promise<Cheatsheet[]> {
  const { data: notebooks, error } = await supabase.from("notebooks").select("id, notebook_pages(id, content)").eq("owner_id", ownerId).eq("cover_color", CHEATSHEET_STORAGE_MARKER).order("updated_at", { ascending: false });
  if (error) throw error;
  return (notebooks ?? []).flatMap(n => (n.notebook_pages ?? []).flatMap(p => {
    const content = p.content as Record<string, unknown> | null;
    const parsed = parseCheatsheet(content?.cheatsheet);
    return content?.kind === "cheatsheet" && parsed ? [{ ...parsed, id: p.id, notebookId: n.id }] : [];
  }));
}
export async function saveCheatsheet(ownerId: string, data: CheatsheetData, existing?: Cheatsheet): Promise<Cheatsheet> {
  if (!validCheatsheet(data)) throw new Error("Zkrať každou stranu na nejvýš 8 řádků a 220 znaků.");
  await currentOwner(ownerId);
  const content = { kind: "cheatsheet", cheatsheet: { version: 1, title: data.title, subject: data.subject, fontPt: data.fontPt, front: data.front.replace(/\r\n?/g, "\n"), back: data.back.replace(/\r\n?/g, "\n") } };
  if (existing) {
    const { data: parent, error: parentError } = await supabase.from("notebooks").select("id").eq("id", existing.notebookId).eq("owner_id", ownerId).eq("cover_color", CHEATSHEET_STORAGE_MARKER).single();
    if (parentError || !parent) throw new Error("Tahák není dostupný. Obnov seznam.");
    const { data: page, error } = await supabase.from("notebook_pages").update({ content }).eq("id", existing.id).eq("notebook_id", parent.id).select("id").single();
    if (error) throw error;
    return { ...data, id: page.id, notebookId: parent.id };
  }
  const { data: nb, error } = await supabase.from("notebooks").insert({ owner_id: ownerId, title: "Tahák", cover_color: CHEATSHEET_STORAGE_MARKER }).select("id").single();
  if (error) throw error;
  const { data: page, error: pageError } = await supabase.from("notebook_pages").insert({ notebook_id: nb.id, page_order: 0, content }).select("id").single();
  if (pageError) {
    // Only the empty container created by this exact operation may be removed.
    await supabase.from("notebooks").delete().eq("id", nb.id).eq("owner_id", ownerId).eq("cover_color", CHEATSHEET_STORAGE_MARKER);
    throw pageError;
  }
  return { ...data, id: page.id, notebookId: nb.id };
}
export async function deleteCheatsheet(ownerId: string, sheet: Cheatsheet) {
  await currentOwner(ownerId);
  const { data, error } = await supabase.from("notebooks").delete().eq("id", sheet.notebookId).eq("owner_id", ownerId).eq("cover_color", CHEATSHEET_STORAGE_MARKER).select("id").single();
  if (error || !data) throw new Error("Tahák se nepodařilo smazat. Obnov seznam a zkus to znovu.");
}