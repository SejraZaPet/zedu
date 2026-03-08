import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface OrderingData {
  items: string[];
}

const SortableItem = ({
  id,
  text,
  index,
  checked,
  isCorrect,
}: {
  id: string;
  text: string;
  index: number;
  checked: boolean;
  isCorrect?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: checked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
        isDragging
          ? "border-primary bg-primary/10 shadow-lg"
          : checked && isCorrect
          ? "border-green-500/60 bg-green-500/10"
          : checked && !isCorrect
          ? "border-destructive/60 bg-destructive/10"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      {!checked && (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      {checked && (
        <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 ${
          isCorrect ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"
        }`}>
          {index + 1}
        </span>
      )}
      <span className="text-foreground">{text}</span>
    </div>
  );
};

const OrderingActivity = ({ ordering }: { ordering: OrderingData }) => {
  const correctOrder = ordering.items;

  // Create shuffled order once
  const initialOrder = useMemo(() => {
    const indices = correctOrder.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.map((i) => ({ id: `item-${i}`, text: correctOrder[i], correctIndex: i }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctOrder.join(",")]);

  const [items, setItems] = useState(initialOrder);
  const [checked, setChecked] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((it) => it.id === active.id);
        const newIndex = prev.findIndex((it) => it.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const score = items.reduce(
    (acc, item, i) => acc + (item.correctIndex === i ? 1 : 0),
    0
  );
  const total = items.length;
  const allCorrect = score === total;

  const handleReset = () => {
    const indices = correctOrder.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setItems(indices.map((i) => ({ id: `item-${i}`, text: correctOrder[i], correctIndex: i })));
    setChecked(false);
  };

  if (!ordering?.items?.length) return null;

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item, i) => (
              <SortableItem
                key={item.id}
                id={item.id}
                text={item.text}
                index={i}
                checked={checked}
                isCorrect={item.correctIndex === i}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!checked && (
        <button
          onClick={() => setChecked(true)}
          className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Zkontrolovat
        </button>
      )}

      {checked && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 text-sm ${allCorrect ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
            {allCorrect
              ? "✓ Výborně! Správné pořadí!"
              : `✗ Skóre: ${score}/${total} správně.`}
            {!allCorrect && (
              <button className="ml-3 underline text-xs" onClick={handleReset}>
                Zkusit znovu
              </button>
            )}
          </div>
          {!allCorrect && (
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => {
                setItems(correctOrder.map((text, i) => ({ id: `item-${i}`, text, correctIndex: i })));
                setChecked(true);
              }}
            >
              Zobrazit řešení
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderingActivity;
