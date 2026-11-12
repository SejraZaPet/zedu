import { useState } from "react";
import { getActivityStartPref, setActivityStartPref, type ActivityStartMode } from "@/lib/activity-start-pref";

/** Přepínač před spuštěním prezentace; volba se zapamatuje pro příští spuštění. */
const ActivityStartModeToggle = () => {
  const [mode, setMode] = useState<ActivityStartMode>(getActivityStartPref);
  const pick = (m: ActivityStartMode) => { setMode(m); setActivityStartPref(m); };
  const opt = (m: ActivityStartMode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => pick(m)}
      className={`min-h-[44px] px-4 rounded-md text-sm font-medium transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Aktivity spouštět" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Aktivity v prezentaci spouštět:</span>
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
        {opt("manual", "ručně")}
        {opt("auto", "automaticky")}
      </div>
    </div>
  );
};

export default ActivityStartModeToggle;
