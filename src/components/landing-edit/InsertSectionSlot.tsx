import { Plus } from "lucide-react";

interface Props {
  onClick: () => void;
  label?: string;
}

/** Thin insert-between marker shown in edit mode; expands on hover. */
export default function InsertSectionSlot({ onClick, label = "Přidat sekci sem" }: Props) {
  return (
    <div className="relative group h-6 flex items-center justify-center">
      <div className="absolute inset-x-6 top-1/2 h-px bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="relative z-10 flex items-center gap-1.5 rounded-full border border-primary/40 bg-background text-primary text-xs px-3 py-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground"
      >
        <Plus className="w-3.5 h-3.5" /> {label}
      </button>
    </div>
  );
}
