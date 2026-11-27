import type { ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EditorLeftTab = "elements" | "activities" | "lesson" | "templates";

export const EDITOR_LEFT_TABS: { id: EditorLeftTab; label: string }[] = [
  { id: "elements", label: "Prvky" },
  { id: "activities", label: "Aktivity" },
  { id: "lesson", label: "Z lekce" },
  { id: "templates", label: "Šablony" },
];

interface Props {
  active: EditorLeftTab;
  onChange: (tab: EditorLeftTab) => void;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Sbalitelný levý panel se čtyřmi stabilními záložkami. */
export default function PresentationLeftPanel({ active, onChange, open, onToggle, children }: Props) {
  if (!open) {
    return (
      <div className="deck-left-reopen">
        <Button variant="outline" size="icon" onClick={onToggle} aria-label="Otevřít levý panel" title="Otevřít panel prvků">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <aside className="deck-left-panel" data-slide-sidebar="true" aria-label="Knihovna obsahu">
      <div className="flex items-center gap-1 p-2 pb-0">
        <div role="tablist" aria-label="Obsah editoru" className="grid min-w-0 flex-1 grid-cols-4 gap-1">
          {EDITOR_LEFT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`editor-tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`editor-panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={`deck-left-tab ${active === tab.id ? "deck-left-tab--active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-7 shrink-0" onClick={onToggle} aria-label="Sbalit levý panel" title="Sbalit panel">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div
        role="tabpanel"
        id={`editor-panel-${active}`}
        aria-labelledby={`editor-tab-${active}`}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
      >
        {children}
      </div>
    </aside>
  );
}
