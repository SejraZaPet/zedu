import { useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const LESSON_TOPIC_MAX = 200;
export const LESSON_NOTE_MAX = 1000;

interface Props {
  topic: string | null;
  /** Vrací true při úspěšném uložení; při chybě editor zůstane otevřený. */
  onSave: (topic: string | null) => Promise<boolean>;
  /** Volitelný „Popis hodiny“; bez `onSaveNote` se pole nezobrazí. */
  note?: string | null;
  onSaveNote?: (note: string | null) => Promise<boolean>;
}

/** Inline editor veřejného tématu proběhlé hodiny (funguje i bez plánu hodiny). */
export function LessonTopicEditor({ topic, onSave, note = null, onSaveNote }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const save = async (value: string | null) => {
    setBusy(true);
    let ok = true;
    // Ukládá jen to, co se změnilo, aby se téma a popis navzájem nepřepisovaly.
    if (value !== (topic ?? null)) ok = await onSave(value);
    if (ok && onSaveNote) {
      const n = noteDraft.trim() || null;
      if (n !== (note ?? null)) ok = await onSaveNote(n);
    }
    setBusy(false);
    if (ok) close();
  };

  if (!editing) {
    return (
      <div className="min-w-0">
      <Button
        ref={triggerRef}
        type="button"
        variant={topic ? "ghost" : "outline"}
        size="sm"
        className="mt-1 h-auto min-h-11 w-full justify-start whitespace-normal break-words px-2 py-1.5 text-left text-xs"
        onClick={() => { setDraft(topic ?? ""); setNoteDraft(note ?? ""); setEditing(true); }}
        aria-label={topic ? `Upravit téma hodiny: ${topic}` : "Přidat téma hodiny"}
      >
        {topic ? <Pencil className="mr-1.5 h-3.5 w-3.5 shrink-0" /> : <Plus className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
        <span>{topic ? `Téma: ${topic}` : "Přidat téma hodiny"}</span>
      </Button>
      {onSaveNote && note && (
        <p className="mt-1 whitespace-pre-line break-words px-2 text-xs text-muted-foreground" data-testid="lesson-note">{note}</p>
      )}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1.5" role="group" aria-label="Téma hodiny">
      <Input
        autoFocus
        value={draft}
        maxLength={LESSON_TOPIC_MAX}
        onChange={(ev) => setDraft(ev.target.value)}
        placeholder="Např. Opakování zlomků"
        aria-label="Téma hodiny"
        className="h-11 text-sm"
        onKeyDown={(ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); void save(draft.trim() || null); }
          if (ev.key === "Escape") { ev.preventDefault(); close(); }
        }}
      />
      {onSaveNote && (
        <div className="space-y-1">
          <Textarea
            value={noteDraft}
            maxLength={LESSON_NOTE_MAX}
            onChange={(ev) => setNoteDraft(ev.target.value)}
            placeholder="Popis hodiny (nepovinné) – co budeme dělat, co si přinést…"
            aria-label="Popis hodiny"
            rows={3}
            className="text-sm"
          />
          <p className="text-right text-[11px] text-muted-foreground" aria-live="polite">{noteDraft.length} / {LESSON_NOTE_MAX}</p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Uvidí to žáci u této hodiny (Nadcházející / Co jste probrali).</p>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" className="min-h-11" disabled={busy} onClick={() => save(draft.trim() || null)}>
          Uložit
        </Button>
        <Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={busy} onClick={close}>
          Zrušit
        </Button>
        {topic && (
          <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive" disabled={busy} onClick={() => save(null)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Smazat téma
          </Button>
        )}
      </div>
    </div>
  );
}
