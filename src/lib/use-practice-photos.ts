import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { disposePracticePhoto, preparePracticePhoto, PRACTICE_PHOTO_UNREADABLE_MESSAGE, type PreparedPracticePhoto } from "@/lib/practice-photo";
import { practiceErrorMessage } from "@/lib/practice-error";

export const MAX_PRACTICE_PHOTOS = 6;
export type PracticePhotoEntry = { id: string; file: File; photo: PreparedPracticePhoto | null; text: string; error: string | null };

/** Ephemeral photos only: one JPEG per OCR request, no persistence or automatic retries. */
export function usePracticePhotos(onReject: (message: string) => void) {
  const [entries, setEntries] = useState<PracticePhotoEntry[]>([]);
  const current = useRef<PracticePhotoEntry[]>([]);
  const locked = useRef(false);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [text, setText] = useState("");
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const commit = (next: PracticePhotoEntry[], merge = false) => {
    current.current = next;
    if (!mounted.current) return;
    setEntries(next);
    setConfirmed(false);
    if (merge) setText(next.map((entry) => entry.text).filter(Boolean).join("\n\n"));
  };
  const clear = () => {
    epoch.current++;
    current.current.forEach((entry) => disposePracticePhoto(entry.photo));
    commit([]);
    setText(""); setReview(false); setConfirmed(false);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
      current.current.forEach((entry) => disposePracticePhoto(entry.photo));
      current.current = [];
    };
  }, []);
  const run = async (items: PracticePhotoEntry[], ocr: boolean) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setConfirmed(false);
    const version = epoch.current;
    try {
      for (const [index, entry] of items.entries()) {
        if (version !== epoch.current) break;
        setProgress(`Fotka ${index + 1} z ${items.length}`);
        let photo = entry.photo;
        try {
          if (!photo) photo = await preparePracticePhoto(entry.file);
          if (version !== epoch.current) { disposePracticePhoto(photo); break; }
          commit(current.current.map((item) => item.id === entry.id ? { ...item, photo, error: null } : item));
          if (!ocr) continue;
          const { data, error } = await supabase.functions.invoke("extract-practice-photo-text", {
            body: { imageBase64: photo.imageBase64, mimeType: photo.mimeType },
          });
          if (version !== epoch.current) break;
          if (error) throw error;
          if (data?.error) throw new Error(data.error === "UNREADABLE_PHOTO" || data.error === "INSUFFICIENT_TEXT" ? data.error : (data.message ?? data.error));
          const result = typeof data?.text === "string" ? data.text.trim() : "";
          if (!result) throw new Error("UNREADABLE_PHOTO");
          commit(current.current.map((item) => item.id === entry.id ? { ...item, text: result, error: null } : item), true);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const readable = await practiceErrorMessage(error);
          if (version !== epoch.current) break;
          const reason = message.includes("UNREADABLE_PHOTO") ? PRACTICE_PHOTO_UNREADABLE_MESSAGE
            : message.includes("INSUFFICIENT_TEXT") ? "Na fotce je málo textu. Zkus jinou stránku nebo text doplň ručně." : readable;
          commit(current.current.map((item) => item.id === entry.id ? { ...item, error: reason } : item));
        }
      }
      if (ocr && version === epoch.current) setReview(true);
    } finally {
      locked.current = false;
      if (mounted.current) { setBusy(false); setProgress(""); }
    }
  };
  const add = async (files: File[]) => {
    if (locked.current || !files.length) return;
    if (current.current.length + files.length > MAX_PRACTICE_PHOTOS) {
      onReject("Můžeš přidat nejvýše 6 fotek celkem. Celý tento výběr byl odmítnut; vyber méně fotek nebo některé odeber.");
      return;
    }
    const items = files.map((file) => ({ id: crypto.randomUUID(), file, photo: null, text: "", error: null }));
    commit([...current.current, ...items]);
    await run(items, false);
  };
  const remove = (id: string) => {
    if (locked.current) return;
    disposePracticePhoto(current.current.find((item) => item.id === id)?.photo ?? null);
    commit(current.current.filter((item) => item.id !== id), true);
  };
  const move = (id: string, delta: number) => {
    if (locked.current) return;
    const next = [...current.current];
    const index = next.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit(next, true);
  };
  return { entries, busy, progress, text, setText, review, setReview, confirmed, setConfirmed, clear, add, remove, move,
    transcribe: () => run(current.current.filter((item) => !item.text && !item.error), true),
    retry: (id: string) => run(current.current.filter((item) => item.id === id), true) };
}
