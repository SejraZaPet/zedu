import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { LandingSectionRow } from "@/hooks/useLandingSections";

interface LandingEditModeState {
  isEditMode: boolean;
  enterEditMode: () => void;
  exitEditMode: () => void;

  /** Draft props keyed by section id. Missing entry = no local changes. */
  draft: Record<string, Record<string, any>>;
  /** Number of sections with pending changes. */
  dirtyCount: number;
  isDirty: (sectionId: string) => boolean;

  /** Replace draft props for a section. Pass the full next props object. */
  setDraftProps: (sectionId: string, nextProps: Record<string, any>) => void;
  /** Update one path (dot-separated or single key) inside a section's draft, merging with existing props. */
  setDraftField: (section: LandingSectionRow, path: string, value: any) => void;
  /** Read the effective props for rendering: draft if present, else section.props. */
  getEffectiveProps: (section: LandingSectionRow) => Record<string, any>;

  /** Side panel state. */
  activePanelSectionId: string | null;
  openPanel: (sectionId: string) => void;
  closePanel: () => void;

  saveAll: () => Promise<void>;
  discardAll: () => void;
  saving: boolean;
}

const Ctx = createContext<LandingEditModeState | null>(null);

function setDeep(obj: Record<string, any>, path: string, value: any): Record<string, any> {
  const keys = path.split(".");
  const next = { ...obj };
  let cursor: any = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cursor[k] = { ...(cursor[k] ?? {}) };
    cursor = cursor[k];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}

export function LandingEditModeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, Record<string, any>>>({});
  const [activePanelSectionId, setActivePanelSectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirtyCount = Object.keys(draft).length;

  const enterEditMode = useCallback(() => setIsEditMode(true), []);
  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setActivePanelSectionId(null);
    setDraft({});
  }, []);

  const isDirty = useCallback((id: string) => id in draft, [draft]);

  const setDraftProps = useCallback((sectionId: string, nextProps: Record<string, any>) => {
    setDraft((prev) => ({ ...prev, [sectionId]: nextProps }));
  }, []);

  const setDraftField = useCallback((section: LandingSectionRow, path: string, value: any) => {
    setDraft((prev) => {
      const base = prev[section.id] ?? section.props ?? {};
      return { ...prev, [section.id]: setDeep(base, path, value) };
    });
  }, []);

  const getEffectiveProps = useCallback(
    (section: LandingSectionRow) => draft[section.id] ?? section.props ?? {},
    [draft],
  );

  const openPanel = useCallback((id: string) => setActivePanelSectionId(id), []);
  const closePanel = useCallback(() => setActivePanelSectionId(null), []);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["landing_sections"] });
    qc.invalidateQueries({ queryKey: ["landing_sections", "all"] });
  }, [qc]);

  const saveAll = useCallback(async () => {
    const entries = Object.entries(draft);
    if (entries.length === 0) {
      toast.info("Nejsou žádné změny k uložení");
      return;
    }
    setSaving(true);
    try {
      const results = await Promise.all(
        entries.map(([id, props]) =>
          supabase.from("landing_sections").update({ props }).eq("id", id),
        ),
      );
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setDraft({});
      invalidate();
      toast.success(`Uloženo (${entries.length} ${entries.length === 1 ? "sekce" : "sekcí"})`);
    } catch (err: any) {
      toast.error("Uložení selhalo: " + (err?.message || "neznámá chyba"));
    } finally {
      setSaving(false);
    }
  }, [draft, invalidate]);

  const discardAll = useCallback(() => {
    if (Object.keys(draft).length === 0) return;
    setDraft({});
    invalidate();
    toast.success("Změny zahozeny");
  }, [draft, invalidate]);

  // Warn on navigation with unsaved changes.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyCount]);

  const value = useMemo<LandingEditModeState>(
    () => ({
      isEditMode,
      enterEditMode,
      exitEditMode,
      draft,
      dirtyCount,
      isDirty,
      setDraftProps,
      setDraftField,
      getEffectiveProps,
      activePanelSectionId,
      openPanel,
      closePanel,
      saveAll,
      discardAll,
      saving,
    }),
    [
      isEditMode,
      enterEditMode,
      exitEditMode,
      draft,
      dirtyCount,
      isDirty,
      setDraftProps,
      setDraftField,
      getEffectiveProps,
      activePanelSectionId,
      openPanel,
      closePanel,
      saveAll,
      discardAll,
      saving,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLandingEditMode() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLandingEditMode must be used inside LandingEditModeProvider");
  return v;
}

/** Safe variant: returns null outside provider (for use in shared components rendered on non-landing pages). */
export function useLandingEditModeOptional() {
  return useContext(Ctx);
}
