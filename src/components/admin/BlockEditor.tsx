import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Block, BLOCK_TYPES, createDefaultBlock } from "@/lib/textbook-config";
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
import {
  GripVertical,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HeadingBlock from "./block-editors/HeadingBlock";
import ParagraphBlock from "./block-editors/ParagraphBlock";
import BulletListBlock from "./block-editors/BulletListBlock";
import ImageBlock from "./block-editors/ImageBlock";
import ImageTextBlock from "./block-editors/ImageTextBlock";
import CardGridBlock from "./block-editors/CardGridBlock";
import TableBlock from "./block-editors/TableBlock";
import AccordionBlock from "./block-editors/AccordionBlock";
import QuoteBlock from "./block-editors/QuoteBlock";

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

const BlockRenderer = ({ block, onChange }: { block: Block; onChange: (props: Record<string, any>) => void }) => {
  switch (block.type) {
    case "heading": return <HeadingBlock block={block} onChange={onChange} />;
    case "paragraph": return <ParagraphBlock block={block} onChange={onChange} />;
    case "bullet_list": return <BulletListBlock block={block} onChange={onChange} />;
    case "image": return <ImageBlock block={block} onChange={onChange} />;
    case "image_text": return <ImageTextBlock block={block} onChange={onChange} />;
    case "card_grid": return <CardGridBlock block={block} onChange={onChange} />;
    case "table": return <TableBlock block={block} onChange={onChange} />;
    case "accordion": return <AccordionBlock block={block} onChange={onChange} />;
    case "quote": return <QuoteBlock block={block} onChange={onChange} />;
    default: return <p className="text-muted-foreground text-sm">Neznámý blok</p>;
  }
};

const SortableBlock = ({
  block,
  onUpdate,
  onDuplicate,
  onToggle,
  onDelete,
}: {
  block: Block;
  onUpdate: (props: Record<string, any>) => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeLabel = BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type;

  return (
    <div ref={setNodeRef} style={style} className={`border rounded-lg bg-card ${!block.visible ? "opacity-50" : ""} ${isDragging ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30 rounded-t-lg">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground p-0.5">
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-muted-foreground flex-1">{typeLabel}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle} title={block.visible ? "Skrýt" : "Zobrazit"}>
          {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate} title="Duplikovat">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} title="Smazat">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="p-3">
        <BlockRenderer block={block} onChange={onUpdate} />
      </div>
    </div>
  );
};

const BlockEditor = ({ blocks, onChange }: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      onChange(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const updateBlock = (id: string, props: Record<string, any>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, props } : b)));
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const original = blocks[idx];
    const copy: Block = { ...original, id: crypto.randomUUID(), props: { ...original.props } };
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const toggleBlock = (id: string) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
  };

  const deleteBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const addBlock = (type: Block["type"]) => {
    onChange([...blocks, createDefaultBlock(type)]);
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              onUpdate={(props) => updateBlock(block.id, props)}
              onDuplicate={() => duplicateBlock(block.id)}
              onToggle={() => toggleBlock(block.id)}
              onDelete={() => deleteBlock(block.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Zatím žádné bloky. Přidejte první blok níže.
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full"><Plus className="w-4 h-4 mr-2" />Přidat blok</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          {BLOCK_TYPES.map((bt) => (
            <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type)}>
              <span className="w-5 text-center mr-2">{bt.icon}</span>{bt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default BlockEditor;
