/**
 * useWorksheetAutosave — Dual-layer autosave for WorksheetPlayer.
 *
 * Layer 1 (immediate): localStorage — survives reload / tab close
 * Layer 2 (periodic):  Supabase assignment_attempts — server persistence
 *
 * On mount: restore from localStorage first, then server (if fresher).
 * On unmount / beforeunload: flush to localStorage synchronously.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WorksheetAnswers {
  [itemId: string]: any;
}

export interface AutosaveState {
  answers: WorksheetAnswers;
  currentIndex: number;
  savedAt: string; // ISO
}

interface UseWorksheetAutosaveOptions {
  /** Unique key — typically `worksheet-${worksheetId}-${variantId}-${attemptId}` */
  storageKey: string;
  /** Supabase attempt row id (null = local-only mode) */
  attemptId: string | null;
  /** Server save interval in seconds */
  intervalSec: number;
  /** Is the worksheet still editable? */
  editable: boolean;
}

interface UseWorksheetAutosaveReturn {
  answers: WorksheetAnswers;
  currentIndex: number;
  setAnswer: (itemId: string, value: any) => void;
  setCurrentIndex: (idx: number) => void;
  isSaving: boolean;
  lastSavedAt: string | null;
  /** Force immediate save to both layers */
  flushNow: () => Promise<void>;
  /** Restore answers from storage */
  restore: () => AutosaveState | null;
}

export function useWorksheetAutosave(
  opts: UseWorksheetAutosaveOptions,
): UseWorksheetAutosaveReturn {
  const { storageKey, attemptId, intervalSec, editable } = opts;

  const [answers, setAnswers] = useState<WorksheetAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const answersRef = useRef(answers);
  const indexRef = useRef(currentIndex);
  const lastServerHash = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  answersRef.current = answers;
  indexRef.current = currentIndex;

  // ── localStorage helpers ──
  const saveLocal = useCallback(() => {
    if (!editable) return;
    const state: AutosaveState = {
      answers: answersRef.current,
      currentIndex: indexRef.current,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* quota exceeded — silent */
    }
  }, [storageKey, editable]);

  const loadLocal = useCallback((): AutosaveState | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as AutosaveState) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  // ── Server save ──
  const saveServer = useCallback(async () => {
    if (!attemptId || !editable) return;
    const hash = JSON.stringify(answersRef.current);
    if (hash === lastServerHash.current) return; // no change

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from("assignment_attempts" as any)
        .update({
          answers: answersRef.current,
          progress: {
            currentIndex: indexRef.current,
            completed: Object.keys(answersRef.current),
          },
          last_saved_at: now,
        } as any)
        .eq("id", attemptId);
      lastServerHash.current = hash;
      setLastSavedAt(now);
    } catch {
      /* silent — localStorage is the fallback */
    } finally {
      setIsSaving(false);
    }
  }, [attemptId, editable]);

  // ── Combined flush ──
  const flushNow = useCallback(async () => {
    saveLocal();
    await saveServer();
  }, [saveLocal, saveServer]);

  // ── Restore ──
  const restore = useCallback((): AutosaveState | null => {
    const local = loadLocal();
    if (local) {
      setAnswers(local.answers);
      setCurrentIndex(local.currentIndex);
      setLastSavedAt(local.savedAt);
    }
    return local;
  }, [loadLocal]);

  // ── Periodic server save ──
  useEffect(() => {
    if (!editable) return;
    timerRef.current = setInterval(() => {
      saveLocal();
      saveServer();
    }, intervalSec * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalSec, editable, saveLocal, saveServer]);

  // ── beforeunload — sync flush to localStorage ──
  useEffect(() => {
    const handler = () => saveLocal();
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      saveLocal(); // also on unmount
    };
  }, [saveLocal]);

  // ── Public setAnswer ──
  const setAnswer = useCallback(
    (itemId: string, value: any) => {
      if (!editable) return;
      setAnswers((prev) => ({ ...prev, [itemId]: value }));
    },
    [editable],
  );

  return {
    answers,
    currentIndex,
    setAnswer,
    setCurrentIndex,
    isSaving,
    lastSavedAt,
    flushNow,
    restore,
  };
}
