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
import { loadWork, saveDraft, submitWork, type WorkTarget } from "@/lib/worksheet-work";

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
  /**
   * Vlastní práce žáka mimo úkol. Použije se JEN když attemptId je null;
   * server vrstva pak ukládá do `student_worksheet_work`.
   */
  work?: WorkTarget | null;
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
  /** Stav vlastní práce (jen v režimu `work`). */
  workStatus: "draft" | "submitted" | null;
  /** Poslední odevzdané skóre obnovené ze serveru (režim `work`). */
  workResult: { score: number; maxScore: number } | null;
  /** Odevzdá vlastní práci (režim `work`). */
  submitOwnWork: (score: number, maxScore: number) => Promise<boolean>;
  /** Začne nový koncept; předchozí odevzdaná verze zůstává v DB. */
  startOver: () => void;
}

export function useWorksheetAutosave(
  opts: UseWorksheetAutosaveOptions,
): UseWorksheetAutosaveReturn {
  const { storageKey, attemptId, intervalSec, editable } = opts;
  const work = attemptId ? null : opts.work ?? null;
  const workKey = work ? `${work.worksheetId}|${work.studentId}|${work.variantId}` : "";

  const [answers, setAnswers] = useState<WorksheetAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const answersRef = useRef(answers);
  const indexRef = useRef(currentIndex);
  const lastServerHash = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workRef = useRef(work);
  workRef.current = work;
  const workIdRef = useRef<string | null>(null);
  const [workStatus, setWorkStatus] = useState<"draft" | "submitted" | null>(work ? "draft" : null);
  const workStatusRef = useRef(workStatus);
  workStatusRef.current = workStatus;
  const [workResult, setWorkResult] = useState<{ score: number; maxScore: number } | null>(null);

  answersRef.current = answers;
  indexRef.current = currentIndex;

  // ── localStorage helpers ──
  const saveLocal = useCallback(() => {
    if (!editable || workStatusRef.current === "submitted") return;
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
    if (!editable) return;
    const hash = JSON.stringify(answersRef.current);
    if (hash === lastServerHash.current) return; // no change
    const w = workRef.current;
    if (!attemptId && w) {
      if (workStatusRef.current !== "draft") return;
      setIsSaving(true);
      try {
        const id = await saveDraft(w, answersRef.current, workIdRef.current);
        if (id) {
          workIdRef.current = id;
          lastServerHash.current = hash;
          setLastSavedAt(new Date().toISOString());
        }
      } catch {
        /* silent — localStorage is the fallback */
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!attemptId) return;

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

  // ── Work mode: reconcile local vs server on mount ──
  useEffect(() => {
    const w = workRef.current;
    if (!w) return;
    let cancelled = false;
    (async () => {
      const { draft, lastSubmitted } = await loadWork(w);
      if (cancelled) return;
      const local = loadLocal();
      const localTs = local ? Date.parse(local.savedAt) : 0;
      if (draft) {
        workIdRef.current = draft.id;
        if (Date.parse(draft.updated_at) > localTs) {
          setAnswers(draft.answers ?? {});
          lastServerHash.current = JSON.stringify(draft.answers ?? {});
          setLastSavedAt(draft.updated_at);
        }
        setWorkStatus("draft");
      } else if (lastSubmitted && Date.parse(lastSubmitted.submitted_at ?? lastSubmitted.updated_at) >= localTs) {
        setAnswers(lastSubmitted.answers ?? {});
        lastServerHash.current = JSON.stringify(lastSubmitted.answers ?? {});
        setWorkStatus("submitted");
        setWorkResult({ score: Number(lastSubmitted.score ?? 0), maxScore: Number(lastSubmitted.max_score ?? 0) });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workKey]);

  const submitOwnWork = useCallback(
    async (score: number, maxScore: number) => {
      const w = workRef.current;
      if (!w) return false;
      const ok = await submitWork(w, answersRef.current, workIdRef.current, score, maxScore);
      if (ok) {
        workIdRef.current = null;
        lastServerHash.current = JSON.stringify(answersRef.current);
        setWorkStatus("submitted");
        setWorkResult({ score, maxScore });
        try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      }
      return ok;
    },
    [storageKey],
  );

  const startOver = useCallback(() => {
    workIdRef.current = null;
    lastServerHash.current = "";
    setAnswers({});
    setCurrentIndex(0);
    setWorkResult(null);
    setWorkStatus("draft");
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

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
    const handler = () => {
      saveLocal();
      if (workRef.current) void saveServer();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      saveLocal(); // also on unmount
      if (workRef.current) void saveServer();
    };
  }, [saveLocal, saveServer]);

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
    workStatus,
    workResult,
    submitOwnWork,
    startOver,
  };
}
