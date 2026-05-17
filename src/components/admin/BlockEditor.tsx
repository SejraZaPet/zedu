import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  Undo2,
  Redo2,
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
import LessonLinkBlock from "./block-editors/LessonLinkBlock";
import YouTubeBlock from "./block-editors/YouTubeBlock";
import CalloutBlock from "./block-editors/CalloutBlock";
import DividerBlock from "./block-editors/DividerBlock";
import TwoColumnBlock from "./block-editors/TwoColumnBlock";
import GalleryBlock from "./block-editors/GalleryBlock";
import SummaryBlock from "./block-editors/SummaryBlock";
import ActivityBlock from "./block-editors/ActivityBlock";

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
    case "lesson_link": return <LessonLinkBlock block={block} onChange={onChange} />;
    case "youtube": return <YouTubeBlock block={block} onChange={onChange} />;
    case "callout": return <CalloutBlock block={block} onChange={onChange} />;
    case "divider": return <DividerBlock block={block} onChange={onChange} />;
    case "two_column": return <TwoColumnBlock block={block} onChange={onChange} />;
    case "gallery": return <GalleryBlock block={block} onChange={onChange} />;
    case "summary": return <SummaryBlock block={block} onChange={onChange} />;
    case "activity": return <ActivityBlock block={block} onChange={onChange} />;
    default: return <p className="text-muted-foreground text-sm">Neznámý blok</p>;
  }
};

const SortableBlock = React.memo(({
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
});
SortableBlock.displayName = "SortableBlock";

const InsertButton = React.memo(({ onInsert }: { onInsert: (type: Block["type"]) => void }) => (
  <div className="flex justify-center py-0.5 group">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
          title="Vložit blok zde"
        >
          <Plus className="w-3 h-3 text-primary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48 max-h-[360px] overflow-y-auto overflow-x-hidden">
        {BLOCK_TYPES.map((bt) => (
          <DropdownMenuItem key={bt.type} onClick={() => onInsert(bt.type)} className="py-1.5 px-2 text-sm">
            <span className="w-5 text-center mr-2">{bt.icon}</span>{bt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
));
InsertButton.displayName = "InsertButton";

const BlockEditor = ({ blocks, onChange }: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Undo/redo history
  const historyRef = useRef<Block[][]>([blocks]);
  const indexRef = useRef<number>(0);
  const skipNextSyncRef = useRef<boolean>(false);
  const [, forceRender] = useState(0);

  // Sync external blocks changes into history (e.g. initial load)
  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const current = historyRef.current[indexRef.current];
    if (current === blocks) return;
    // Replace history with new external state
    historyRef.current = [blocks];
    indexRef.current = 0;
    forceRender((n) => n + 1);
  }, [blocks]);

  const commit = (next: Block[]) => {
    // Truncate redo branch and push new state
    const newHistory = historyRef.current.slice(0, indexRef.current + 1);
    newHistory.push(next);
    // Cap history length
    if (newHistory.length > 100) newHistory.shift();
    historyRef.current = newHistory;
    indexRef.current = newHistory.length - 1;
    skipNextSyncRef.current = true;
    onChange(next);
    forceRender((n) => n + 1);
  };

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  const undo = () => {
    if (!canUndo) return;
    indexRef.current -= 1;
    skipNextSyncRef.current = true;
    onChange(historyRef.current[indexRef.current]);
    forceRender((n) => n + 1);
  };

  const redo = () => {
    if (!canRedo) return;
    indexRef.current += 1;
    skipNextSyncRef.current = true;
    onChange(historyRef.current[indexRef.current]);
    forceRender((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      commit(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const updateBlock = useCallback((id: string, props: Record<string, any>) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, props } : b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const duplicateBlock = useCallback((id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const original = blocks[idx];
    const copy: Block = { ...original, id: crypto.randomUUID(), props: { ...original.props } };
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const toggleBlock = useCallback((id: string) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const deleteBlock = useCallback((id: string) => {
    commit(blocks.filter((b) => b.id !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const addBlock = useCallback((type: Block["type"], index?: number) => {
    if (index === undefined || index >= blocks.length) {
      commit([...blocks, createDefaultBlock(type)]);
    } else {
      const next = [...blocks];
      next.splice(index, 0, createDefaultBlock(type));
      commit(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const insertBlockAfter = useCallback((afterId: string, type: Block["type"]) => {
    const idx = blocks.findIndex((b) => b.id === afterId);
    const newBlock = createDefaultBlock(type);
    const next = [...blocks];
    next.splice(idx + 1, 0, newBlock);
    commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadImageFile = async (file: File): Promise<string | null> => {
    const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("lesson-images")
      .upload(path, file, { contentType: file.type || `image/${ext}`, upsert: false });
    if (error) {
      console.warn("Image upload failed:", error);
      return null;
    }
    const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const appendImageBlock = useCallback((url: string, caption = "") => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: "image",
      visible: true,
      props: { url, caption, width: "full", alignment: "center" },
    } as unknown as Block;
    commit([...blocksRef.current, newBlock]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    try {
      let added = 0;
      for (const file of files) {
        const url = await uploadImageFile(file);
        if (!url) continue;
        appendImageBlock(url, file.name.replace(/\.[^.]+$/, ""));
        added++;
      }
      if (added > 0) toast.success(`Přidáno ${added} obrázků`);
      else toast.error("Nahrání obrázku se nezdařilo.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (!imageItem) return;
      // Don't hijack paste when user is typing in an input/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      setUploading(true);
      try {
        const url = await uploadImageFile(file);
        if (url) {
          appendImageBlock(url);
          toast.success("Obrázek vložen");
        } else {
          toast.error("Nahrání obrázku se nezdařilo.");
        }
      } finally {
        setUploading(false);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => {
        // Only clear when leaving the wrapper itself
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
      className={`relative space-y-3 rounded-lg transition ${dragOver ? "ring-2 ring-primary ring-offset-2 bg-primary/5" : ""}`}
    >
      <div className="flex items-center justify-end gap-1 sticky top-0 z-40 bg-background/80 backdrop-blur-sm py-1 -mt-1 rounded-md">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5"
          onClick={undo}
          disabled={!canUndo}
          title="Zpět (Ctrl/Cmd+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" /> Zpět
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5"
          onClick={redo}
          disabled={!canRedo}
          title="Vpřed (Ctrl/Cmd+Shift+Z)"
        >
          <Redo2 className="w-3.5 h-3.5" /> Vpřed
        </Button>
      </div>
      {dragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 rounded-lg pointer-events-none">
          <p className="text-lg font-medium text-primary">📷 Pusťte obrázek sem</p>
        </div>
      )}
      {uploading && (
        <div className="text-xs text-muted-foreground">Nahrávám obrázek…</div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, idx) => (
            <div key={block.id}>
              <SortableBlock
                block={block}
                onUpdate={(props) => updateBlock(block.id, props)}
                onDuplicate={() => duplicateBlock(block.id)}
                onToggle={() => toggleBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
              />
              {idx < blocks.length - 1 && (
                <div className="group relative h-2 hover:h-8 transition-all flex items-center justify-center">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover:bg-border" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="relative h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Vložit blok zde"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-48 max-h-[360px] overflow-y-auto overflow-x-hidden">
                      {BLOCK_TYPES.map((bt) => (
                        <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type, idx + 1)} className="py-1.5 px-2 text-sm">
                          <span className="w-5 text-center mr-2">{bt.icon}</span>{bt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Zatím žádné bloky. Přidejte první blok níže, nebo přetáhněte obrázek z počítače.
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full"><Plus className="w-4 h-4 mr-2" />Přidat blok</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-48 max-h-[360px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
          {BLOCK_TYPES.map((bt) => (
            <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type)} className="py-1.5 px-2 text-sm">
              <span className="w-5 text-center mr-2">{bt.icon}</span>{bt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default BlockEditor;
