import { useMemo, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Word { id: string; text: string }

function BankWord({ word, used, selected, disabled, onSelect }: { word: Word; used: boolean; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: word.id, disabled: used || disabled });
  return <Button ref={setNodeRef} {...attributes} {...listeners} size="sm" variant={selected ? "default" : "outline"}
    className="touch-none max-w-full h-auto min-h-8 whitespace-normal break-words"
    disabled={used || disabled} aria-pressed={selected} onClick={onSelect}>{word.text}</Button>;
}

function Gap({ index, answer, disabled, selected, onFill, onReturn }: { index: number; answer: string; disabled: boolean; selected: boolean; onFill: () => void; onReturn: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `gap-${index}`, disabled });
  return <span ref={setNodeRef} className="inline-flex items-center mx-1 gap-1">
    <Button size="sm" variant="outline" disabled={disabled} aria-label={`Mezera ${index + 1}${answer ? `: ${answer}` : ""}`}
      className={`min-w-20 max-w-[200px] h-auto min-h-8 whitespace-normal break-words ${isOver || selected ? "border-primary" : ""}`}
      onClick={onFill}>{answer || "…"}</Button>
    {answer && !disabled && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Vrátit slovo z mezery ${index + 1}`} title="Vrátit slovo" onClick={onReturn}><X className="h-4 w-4" /></Button>}
  </span>;
}

/** Bank entries have occurrence IDs: equal words remain independently usable. */
export function FillWordBank({ words, distractors, answers, disabled, onChange, children }: {
  words: string[]; distractors: string[]; answers: string[]; disabled: boolean;
  onChange: (index: number, value: string) => void; children: (renderGap: (index: number) => ReactNode) => ReactNode;
}) {
  const bank = useMemo(() => {
    const entries = [...words, ...distractors].filter(word => word.trim()).map((text, index) => ({ id: `word-${index}`, text: text.trim() }));
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    return entries;
  }, [words, distractors]);
  const [assigned, setAssigned] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const fill = (index: number, id: string | null) => {
    const word = bank.find(entry => entry.id === id);
    if (disabled || !word || Object.values(assigned).includes(word.id)) return;
    setAssigned(previous => ({ ...previous, [index]: word.id }));
    onChange(index, word.text);
    setSelected(null);
  };
  return <DndContext sensors={sensors} onDragStart={({ active }) => setDragging(String(active.id))}
    onDragCancel={() => setDragging(null)} onDragEnd={({ active, over }) => {
      setDragging(null);
      if (over && String(over.id).startsWith("gap-")) fill(Number(String(over.id).slice(4)), String(active.id));
    }}>
    <div role="group" aria-label="Banka slov" className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/30 p-3">
      {bank.map(word => <BankWord key={word.id} word={word} disabled={disabled} used={Object.values(assigned).includes(word.id)} selected={selected === word.id}
        onSelect={() => setSelected(previous => previous === word.id ? null : word.id)} />)}
    </div>
    {children(index => <Gap index={index} answer={answers[index]} disabled={disabled} selected={selected !== null}
      onFill={() => fill(index, selected)} onReturn={() => {
        setAssigned(previous => { const next = { ...previous }; delete next[index]; return next; });
        onChange(index, "");
      }} />)}
    <DragOverlay>{dragging && <span className="rounded-md border border-primary bg-background text-foreground px-3 py-2 shadow-md">{bank.find(word => word.id === dragging)?.text}</span>}</DragOverlay>
  </DndContext>;
}