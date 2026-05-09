import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type LockdownViolation = {
  type:
    | "visibility_hidden"
    | "window_blur"
    | "fullscreen_exit"
    | "copy_blocked"
    | "paste_blocked"
    | "cut_blocked"
    | "context_menu_blocked"
    | "page_unload";
  at: string; // ISO
  detail?: string;
};

interface Options {
  enabled: boolean;
  assignmentId: string | null;
  studentId: string | null;
  attemptId: string | null;
  /** Skip starting/tracking (e.g. attempt is already submitted). */
  paused?: boolean;
}

/**
 * Bezpečný testovací mód:
 * - Vynucuje fullscreen
 * - Blokuje copy/paste/cut/contextmenu
 * - Detekuje opuštění (visibility/blur/fullscreen exit) a varuje při zavření
 * - Loguje porušení do test_sessions
 */
export const useLockdownMode = ({
  enabled,
  assignmentId,
  studentId,
  attemptId,
  paused = false,
}: Options) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [violations, setViolations] = useState<LockdownViolation[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const violationsRef = useRef<LockdownViolation[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<string | null>(null);

  // Initialize / load session
  useEffect(() => {
    if (!enabled || paused || !assignmentId || !studentId) return;
    let cancelled = false;
    (async () => {
      try {
        // Try to find an existing session for this attempt
        if (attemptId) {
          const { data: existing } = await supabase
            .from("test_sessions" as any)
            .select("id, violations_json")
            .eq("attempt_id", attemptId)
            .maybeSingle();
          if (existing && !cancelled) {
            const row = existing as any;
            sessionRef.current = row.id;
            setSessionId(row.id);
            const prev = Array.isArray(row.violations_json) ? row.violations_json : [];
            violationsRef.current = prev;
            setViolations(prev);
            return;
          }
        }
        const { data, error } = await supabase
          .from("test_sessions" as any)
          .insert({
            assignment_id: assignmentId,
            student_id: studentId,
            attempt_id: attemptId,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (!cancelled) {
          const id = (data as any).id as string;
          sessionRef.current = id;
          setSessionId(id);
        }
      } catch (e) {
        console.error("Lockdown session init failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, paused, assignmentId, studentId, attemptId]);

  // Flush violations to DB (debounced)
  const flushViolations = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await supabase
        .from("test_sessions" as any)
        .update({
          violations_json: violationsRef.current as any,
          violation_count: violationsRef.current.length,
          left_test: violationsRef.current.some(
            (v) =>
              v.type === "visibility_hidden" ||
              v.type === "window_blur" ||
              v.type === "fullscreen_exit",
          ),
        } as any)
        .eq("id", sessionRef.current);
    } catch (e) {
      console.error("Lockdown flush failed", e);
    }
  }, []);

  const recordViolation = useCallback(
    (type: LockdownViolation["type"], detail?: string) => {
      const v: LockdownViolation = { type, at: new Date().toISOString(), detail };
      violationsRef.current = [...violationsRef.current, v];
      setViolations(violationsRef.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flushViolations, 800);
    },
    [flushViolations],
  );

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    if (!enabled || paused) return;
    try {
      const el = document.documentElement as any;
      const req =
        el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (req) await req.call(el);
    } catch {
      // Browser may block until user gesture; the UI will prompt.
    }
  }, [enabled, paused]);

  // Event handlers
  useEffect(() => {
    if (!enabled || paused) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        recordViolation("visibility_hidden");
      }
    };
    const onBlur = () => recordViolation("window_blur");
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) recordViolation("fullscreen_exit");
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      recordViolation("page_unload");
      // Synchronous flush attempt via keepalive fetch is unreliable here; just warn.
      e.preventDefault();
      e.returnValue = "Opouštíš testovací režim. Tento pokus bude nahlášen učiteli.";
      return e.returnValue;
    };
    const block = (kind: LockdownViolation["type"]) => (e: Event) => {
      e.preventDefault();
      recordViolation(kind);
      toast({
        title: "Akce zablokována",
        description: "V testovacím režimu nejsou kopírování ani vkládání povoleny.",
        variant: "destructive",
      });
    };
    const onCopy = block("copy_blocked");
    const onPaste = block("paste_blocked");
    const onCut = block("cut_blocked");
    const onContext = (e: Event) => {
      e.preventDefault();
      recordViolation("context_menu_blocked");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContext);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContext);
      // Final flush
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushViolations();
    };
  }, [enabled, paused, recordViolation, flushViolations]);

  // End session helper
  const endSession = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await supabase
        .from("test_sessions" as any)
        .update({
          ended_at: new Date().toISOString(),
          violations_json: violationsRef.current as any,
          violation_count: violationsRef.current.length,
        } as any)
        .eq("id", sessionRef.current);
    } catch (e) {
      console.error("Lockdown end failed", e);
    }
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* noop */ }
    }
  }, []);

  return {
    sessionId,
    violations,
    violationCount: violations.length,
    isFullscreen,
    requestFullscreen,
    endSession,
  };
};
