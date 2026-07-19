import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Block, BLOCK_TYPES, createDefaultBlock, normalizeBlocks } from "@/lib/textbook-config";
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
  Search,
  Heading as IconHeading,
  Type as IconType,
  List as IconList,
  Quote as IconQuote,
  Info as IconInfo,
  Image as IconImage,
  Images as IconImages,
  LayoutTemplate as IconLayoutTemplate,
  Youtube as IconYoutube,
  LayoutGrid as IconLayoutGrid,
  Table as IconTable,
  Columns2 as IconColumns2,
  Triangle as IconTriangle,
  ChevronDown as IconChevronDown,
  Minus as IconMinus,
  Sparkles as IconSparkles,
  ClipboardList as IconClipboard,
  Link2 as IconLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import HierarchyBlock from "./block-editors/HierarchyBlock";

// --- Categorization: card visuals (Step 1) ---
type CategoryKey = "text" | "media" | "structure" | "interactive";

const CARD_CATEGORY: Record<string, CategoryKey> = {
  heading: "text", paragraph: "text", bullet_list: "text",
  quote: "text", callout: "text", summary: "text",
  image: "media", image_text: "media", gallery: "media", youtube: "media",
  card_grid: "structure", table: "structure", two_column: "structure",
  hierarchy: "structure", accordion: "structure", divider: "structure",
  activity: "interactive", lesson_link: "interactive",
};

const CATEGORY_STYLES: Record<CategoryKey, {
  border: string; headerBg: string; iconColor: string; labelColor: string;
  borderWidth: number; solid?: boolean;
}> = {
  text:        { border: "#E5E5E5", headerBg: "#FFFFFF", iconColor: "#525252", labelColor: "#525252", borderWidth: 1 },
  media:       { border: "#C3EAE6", headerBg: "#E0F5F3", iconColor: "#0F9A8B", labelColor: "#0B6E5D", borderWidth: 1 },
  structure:   { border: "#D9CFEC", headerBg: "#F4F0FA", iconColor: "#6B5BA6", labelColor: "#6B5BA6", borderWidth: 1 },
  interactive: { border: "#0F9A8B", headerBg: "#0F9A8B", iconColor: "#FFFFFF", labelColor: "#FFFFFF", borderWidth: 1.5, solid: true },
};

// --- Icons per block type (used in card headers + add menu) ---
const BLOCK_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  heading: IconHeading,
  paragraph: IconType,
  bullet_list: IconList,
  quote: IconQuote,
  callout: IconInfo,
  summary: IconClipboard,
  image: IconImage,
  image_text: IconLayoutTemplate,
  gallery: IconImages,
  youtube: IconYoutube,
  card_grid: IconLayoutGrid,
  table: IconTable,
  two_column: IconColumns2,
  hierarchy: IconTriangle,
  accordion: IconChevronDown,
  divider: IconMinus,
  activity: IconSparkles,
  lesson_link: IconLink,
};

// --- Add-menu grouping (Step 2) ---
const MENU_GROUPS: { key: CategoryKey; label: string; types: string[]; accent?: boolean }[] = [
  { key: "text", label: "Text", types: ["heading", "paragraph", "bullet_list", "quote", "callout"] },
  { key: "media", label: "Média", types: ["image", "image_text", "gallery", "youtube"] },
  { key: "structure", label: "Struktura a rozložení", types: ["card_grid", "table", "two_column", "hierarchy", "accordion", "divider"] },
  { key: "interactive", label: "Interaktivní a AI", types: ["activity", "summary", "lesson_link"], accent: true },
];

const MENU_AI_BADGE = new Set(["activity", "summary"]);
const CARD_AI_BADGE = new Set(["activity"]);

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}


const BlockRenderer = React.memo(({ block, onChange }: { block: Block; onChange: (props: Record<string, any>) => void }) => {
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
    case "hierarchy": return <HierarchyBlock block={block} onChange={onChange} />;
    default: return <p className="text-muted-foreground text-sm">Neznámý blok</p>;
  }
});
BlockRenderer.displayName = "BlockRenderer";

const SortableBlock = React.memo(({
  block,
  onUpdate,
  onDuplicate,
  onToggle,
  onDelete,
}: {
  block: Block;
  onUpdate: (id: string, props: Record<string, any>) => void;
  onDuplicate: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeLabel = BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type;
  const handleUpdate = useCallback((props: Record<string, any>) => onUpdate(block.id, props), [onUpdate, block.id]);

  const category: CategoryKey = CARD_CATEGORY[block.type] ?? "text";
  const cat = CATEGORY_STYLES[category];
  const Icon = BLOCK_ICON[block.type];
  const showAiBadge = CARD_AI_BADGE.has(block.type);

  const wrapperStyle: React.CSSProperties = {
    ...style,
    borderRadius: 14,
    borderWidth: cat.borderWidth,
    borderStyle: "solid",
    borderColor: cat.border,
    background: "#FFFFFF",
    boxShadow: "0 1px 3px hsl(228 24% 92% / 0.6), 0 4px 16px -4px hsl(228 24% 92% / 0.4)",
    transition: (style.transition ?? "") + ", border-color 120ms ease, background-color 120ms ease",
    ["--cat-border" as any]: cat.border,
    ["--cat-header-bg" as any]: cat.headerBg,
    ["--cat-icon" as any]: cat.iconColor,
    ["--cat-label" as any]: cat.labelColor,
  };

  const headerBorderBottom = cat.solid ? "1px solid rgba(255,255,255,0.15)" : "1px solid #F0F0F0";

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      data-category={category}
      style={wrapperStyle}
      className={`be-block group/beblock overflow-hidden ${!block.visible ? "opacity-50" : ""}`}
    >
      <div
        className="be-block__header flex items-center gap-2 px-3 py-2"
        style={{ background: cat.headerBg, borderBottom: headerBorderBottom }}
      >
        <button
          {...attributes}
          {...listeners}
          className="be-block__grip cursor-grab p-0.5"
          style={{ color: cat.solid ? "#FFFFFF" : "#737373" }}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {Icon && (
          <Icon className="w-4 h-4" style={{ color: cat.iconColor }} />
        )}
        <span
          className="be-block__label flex-1"
          style={{ color: cat.labelColor, fontWeight: 700, fontSize: 12, letterSpacing: 0.2 }}
        >
          {typeLabel}
        </span>
        {showAiBadge && (
          <span
            style={{
              background: "#FFFFFF",
              color: "#0B6E5D",
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: 0.6,
              padding: "2px 6px",
              borderRadius: 999,
              marginRight: 2,
            }}
          >
            AI
          </span>
        )}
        <Button size="icon" variant="ghost" className="be-block__action h-7 w-7" onClick={() => onToggle(block.id)} title={block.visible ? "Skrýt" : "Zobrazit"}>
          {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="be-block__action h-7 w-7" onClick={() => onDuplicate(block.id)} title="Duplikovat">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="be-block__action h-7 w-7" onClick={() => onDelete(block.id)} title="Smazat">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="p-3" style={{ color: "#171717" }}>
        <BlockRenderer block={block} onChange={handleUpdate} />
      </div>
    </div>
  );
});
SortableBlock.displayName = "SortableBlock";

// Shared grouped/searchable block picker used by both inline "+" and the main "Add block" menu.
const BlockPicker = ({ onPick }: { onPick: (type: Block["type"]) => void }) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  return (
    <div className="w-[320px] max-h-[440px] flex flex-col">
      <div className="p-2 border-b border-[#EFEFEF]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat blok…"
            className="w-full pl-8 pr-2 h-9 text-sm rounded-[10px] border outline-none"
            style={{ background: "#FAFAFA", borderColor: "#E5E5E5", color: "#171717" }}
          />
        </div>
      </div>
      <div className="overflow-y-auto py-1">
        {MENU_GROUPS.map((group) => {
          const items = group.types
            .map((t) => BLOCK_TYPES.find((bt) => bt.type === t))
            .filter((bt): bt is (typeof BLOCK_TYPES)[number] => !!bt)
            .filter((bt) => !q || bt.label.toLowerCase().includes(q));
          if (items.length === 0) return null;
          const headingColor = group.accent ? "#0B6E5D" : "#A3A3A3";
          return (
            <div key={group.key} className="px-1 pb-1">
              <div
                className="px-2 pt-2 pb-1"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: headingColor,
                }}
              >
                {group.label}
              </div>
              {items.map((bt) => {
                const Icon = BLOCK_ICON[bt.type];
                const isAi = MENU_AI_BADGE.has(bt.type);
                const iconColor = group.accent ? "#0B6E5D" : "#525252";
                return (
                  <button
                    key={bt.type}
                    type="button"
                    onClick={() => onPick(bt.type as Block["type"])}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md hover:bg-[#F5F5F5] transition-colors"
                    style={{
                      color: "#171717",
                      background: isAi ? "#F0FAF8" : "transparent",
                    }}
                  >
                    {Icon && <Icon className="w-4 h-4" style={{ color: iconColor }} />}
                    <span className="flex-1 text-left">{bt.label}</span>
                    {isAi && (
                      <span
                        style={{
                          background: "#0F9A8B",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: 9,
                          letterSpacing: 0.6,
                          padding: "2px 6px",
                          borderRadius: 999,
                        }}
                      >
                        AI
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InsertButton = React.memo(({ afterId, onInsert }: { afterId: string; onInsert: (afterId: string, type: Block["type"]) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-center py-0.5 group">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity h-5 w-5 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
            title="Vložit blok zde"
          >
            <Plus className="w-3 h-3 text-primary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="p-0 overflow-hidden">
          <BlockPicker
            onPick={(type) => {
              onInsert(afterId, type);
              setOpen(false);
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
InsertButton.displayName = "InsertButton";


const BlockEditor = ({ blocks, onChange }: Props) => {
  const normalizedBlocks = useMemo(() => normalizeBlocks(blocks), [blocks]);

  useEffect(() => {
    if (normalizedBlocks !== blocks) {
      onChange(normalizedBlocks);
    }
  }, [blocks, normalizedBlocks, onChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Undo/redo history
  const historyRef = useRef<Block[][]>([normalizedBlocks]);
  const indexRef = useRef<number>(0);
  const isInitRef = useRef(false);
  const [undoRedoState, setUndoRedoState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    if (!isInitRef.current) {
      historyRef.current = [normalizedBlocks];
      indexRef.current = 0;
      isInitRef.current = true;
    }
  }, []);

  const blocksRef = useRef(normalizedBlocks);
  blocksRef.current = normalizedBlocks;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pendingScrollToBlockIdRef = useRef<string | null>(null);

  const updateUndoRedoState = useCallback(() => {
    const nextState = {
      canUndo: indexRef.current > 0,
      canRedo: indexRef.current < historyRef.current.length - 1,
    };

    setUndoRedoState((prev) => (
      prev.canUndo === nextState.canUndo && prev.canRedo === nextState.canRedo
        ? prev
        : nextState
    ));
  }, []);

  useEffect(() => {
    const current = historyRef.current[indexRef.current];
    if (current === normalizedBlocks) return;

    historyRef.current = [normalizedBlocks];
    indexRef.current = 0;
    updateUndoRedoState();
  }, [normalizedBlocks, updateUndoRedoState]);

  useEffect(() => {
    const blockId = pendingScrollToBlockIdRef.current;
    if (!blockId) return;

    const frame = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      pendingScrollToBlockIdRef.current = null;
    });

    return () => cancelAnimationFrame(frame);
  }, [normalizedBlocks]);

  const commit = useCallback((next: Block[]) => {
    const newHistory = historyRef.current.slice(0, indexRef.current + 1);
    newHistory.push(next);
    if (newHistory.length > 100) newHistory.shift();
    historyRef.current = newHistory;
    indexRef.current = newHistory.length - 1;
    onChangeRef.current(next);
    updateUndoRedoState();
  }, [updateUndoRedoState]);

  const { canUndo, canRedo } = undoRedoState;

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    onChangeRef.current(historyRef.current[indexRef.current]);
    updateUndoRedoState();
  }, [updateUndoRedoState]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    onChangeRef.current(historyRef.current[indexRef.current]);
    updateUndoRedoState();
  }, [updateUndoRedoState]);

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
  }, [undo, redo]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const cur = blocksRef.current;
      const oldIndex = cur.findIndex((b) => b.id === active.id);
      const newIndex = cur.findIndex((b) => b.id === over.id);
      commit(arrayMove(cur, oldIndex, newIndex));
    }
  }, [commit]);

  const updateBlock = useCallback((id: string, props: Record<string, any>) => {
    commit(blocksRef.current.map((b) => (b.id === id ? { ...b, props } : b)));
  }, [commit]);

  const duplicateBlock = useCallback((id: string) => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const original = cur[idx];
    const copy: Block = { ...original, id: crypto.randomUUID(), props: { ...original.props } };
    const next = [...cur];
    next.splice(idx + 1, 0, copy);
    commit(next);
  }, [commit]);

  const toggleBlock = useCallback((id: string) => {
    commit(blocksRef.current.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
  }, [commit]);

  const deleteBlock = useCallback((id: string) => {
    commit(blocksRef.current.filter((b) => b.id !== id));
  }, [commit]);

  const addBlock = useCallback((type: Block["type"], index?: number) => {
    const cur = blocksRef.current;
    const newBlock = createDefaultBlock(type);
    pendingScrollToBlockIdRef.current = newBlock.id;
    if (index === undefined || index >= cur.length) {
      commit([...cur, newBlock]);
    } else {
      const next = [...cur];
      next.splice(index, 0, newBlock);
      commit(next);
    }
  }, [commit]);

  const insertBlockAfter = useCallback((afterId: string, type: Block["type"]) => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === afterId);
    const next = [...cur];
    const newBlock = createDefaultBlock(type);
    pendingScrollToBlockIdRef.current = newBlock.id;
    next.splice(idx + 1, 0, newBlock);
    commit(next);
  }, [commit]);

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

  const appendImageBlock = useCallback((url: string, caption = "") => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: "image",
      visible: true,
      props: { url, caption, width: "full", alignment: "center" },
    } as unknown as Block;
    commit([...blocksRef.current, newBlock]);
  }, [commit]);
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
  }, []);

  const stableBlockIdsRef = useRef<string[]>(normalizedBlocks.map((b) => b.id));
  const blockIds = useMemo(() => {
    const nextIds = normalizedBlocks.map((b) => b.id);
    const prevIds = stableBlockIdsRef.current;

    if (
      prevIds.length === nextIds.length &&
      prevIds.every((id, index) => id === nextIds[index])
    ) {
      return prevIds;
    }

    stableBlockIdsRef.current = nextIds;
    return nextIds;
  }, [normalizedBlocks]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => {
        // Only clear when leaving the wrapper itself
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
      className={`block-editor-scope relative space-y-3 p-4 rounded-[14px] transition ${dragOver ? "ring-2 ring-offset-2 bg-primary/5" : ""}`}
      style={{ background: "#FAFAFA" }}
    >
      <style>{`
        .block-editor-scope .be-block:focus-within {
          border-color: var(--cat-border) !important;
          border-width: 1.5px !important;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.04), 0 1px 3px hsl(228 24% 92% / 0.6), 0 4px 16px -4px hsl(228 24% 92% / 0.4) !important;
        }
        .block-editor-scope .be-block[data-category="interactive"] .be-block__action { color: rgba(255,255,255,0.85); }
        .block-editor-scope .be-block[data-category="interactive"] .be-block__action:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }
        .block-editor-scope .be-block__action { color: #A3A3A3; }
        .block-editor-scope .be-block__action:hover { color: #525252; background: #F5F5F5; }
        .block-editor-scope .be-add-primary {
          background: #0F9A8B; color: #FFFFFF; border-radius: 24px;
          padding: 0 20px; height: 40px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 8px;
          border: none; transition: background 120ms ease, transform 120ms ease;
        }
        .block-editor-scope .be-add-primary:hover { background: #0B7E71; }
        .block-editor-scope { font-family: 'Lato', system-ui, sans-serif; font-size: 16px; line-height: 1.5; }
        .block-editor-scope .be-block__label { font-size: 14px; font-weight: 700; letter-spacing: 0.01em; }
        .block-editor-scope .be-block h1, .block-editor-scope .be-block [data-heading="1"] { font-size: 32px; font-weight: 700; line-height: 1.2; }
        .block-editor-scope .be-block h2, .block-editor-scope .be-block [data-heading="2"] { font-size: 24px; font-weight: 700; line-height: 1.25; }
        .block-editor-scope .be-block h3, .block-editor-scope .be-block [data-heading="3"] { font-size: 20px; font-weight: 700; line-height: 1.3; }
        .block-editor-scope .be-block h4, .block-editor-scope .be-block [data-heading="4"] { font-size: 18px; font-weight: 700; line-height: 1.35; }
        .block-editor-scope .be-block p, .block-editor-scope .be-block li { font-size: 16px; font-weight: 400; line-height: 1.5; }
        .block-editor-scope .be-block figcaption, .block-editor-scope .be-block .caption { font-size: 14px; color: #737373; }
      `}</style>


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
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {normalizedBlocks.map((block, idx) => (
            <React.Fragment key={block.id}>
              <SortableBlock
                block={block}
                onUpdate={updateBlock}
                onDuplicate={duplicateBlock}
                onToggle={toggleBlock}
                onDelete={deleteBlock}
              />
              {idx < normalizedBlocks.length - 1 && (
                <InsertButton afterId={block.id} onInsert={insertBlockAfter} />
              )}
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>

      {normalizedBlocks.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Zatím žádné bloky. Přidejte první blok níže, nebo přetáhněte obrázek z počítače.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-center pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="be-add-primary">
              <Plus className="w-4 h-4" /> Přidat blok
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-56 max-h-[360px] overflow-y-auto">
            {BLOCK_TYPES.map((bt) => (
              <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type)} className="py-1.5 px-2 text-sm">
                <span className="w-5 text-center mr-2">{bt.icon}</span>{bt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {([
          { key: "text", label: "Text", types: ["heading", "paragraph", "bullet_list", "quote", "callout", "summary"] },
          { key: "table", label: "Tabulka", types: ["table", "accordion", "card_grid", "two_column", "hierarchy", "divider"] },
          { key: "media", label: "Média", types: ["image", "gallery", "image_text", "youtube", "activity", "lesson_link"] },
        ] as const).map((cat) => (
          <DropdownMenu key={cat.key}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="be-add-pill">{cat.label}</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-52 max-h-[360px] overflow-y-auto">
              {BLOCK_TYPES.filter((bt) => (cat.types as readonly string[]).includes(bt.type)).map((bt) => (
                <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type)} className="py-1.5 px-2 text-sm">
                  <span className="w-5 text-center mr-2">{bt.icon}</span>{bt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

    </div>
  );
};

export default BlockEditor;
