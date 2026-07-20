import { createContext, useContext, type ReactNode } from "react";
import type { LandingSectionRow } from "@/hooks/useLandingSections";

const SectionCtx = createContext<LandingSectionRow | null>(null);

export function SectionProvider({ section, children }: { section: LandingSectionRow; children: ReactNode }) {
  return <SectionCtx.Provider value={section}>{children}</SectionCtx.Provider>;
}

/** Returns the current section row, or null when rendered outside a landing page section (e.g. admin panel). */
export function useCurrentSection() {
  return useContext(SectionCtx);
}
