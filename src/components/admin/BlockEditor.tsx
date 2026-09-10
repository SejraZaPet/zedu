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
  Square as IconSquare,
  BarChart3 as IconBarChart,
  Sigma as IconSigma,
  Volume2 as IconVolume2,
  Video as IconVideo,
  ArrowRightLeft,
  Loader2,
  Group as IconGroup,
  Ungroup as IconUngroup,
  X as IconX,
  MoreHorizontal,
  Palette,

} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { blockBackgroundStyle } from "@/lib/block-backgrounds";
import BlockStyleControls from "./block-editors/BlockStyleControls";
import FreeFrameCanvas from "@/components/blocks/FreeFrameCanvas";
import type { BlockFrame } from "@/lib/block-frame";
import {
  getGroupChildFrames,
  getGroupChildHeight,
  setGroupChildHeight,
  GROUP_CHILD_MIN_HEIGHT,
  GROUP_CHILD_MAX_HEIGHT,
  getGroupChildren,
  getGroupLayout,
  getGroupMode,
  groupBlocksIntoSlide,
  isSlideGroup,
  removeChildFromGroup,
  setGroupChildFrame,
  setGroupLayout,
  setGroupMode,
  ungroupSlideGroup,
  updateGroupChild,
  type SlideGroupLayout,
  type SlideGroupMode,
} from "@/lib/slide-groups";

import {
  FORMAT_TARGETS,
  convertBlock,
  blockToPlainText,
  blockHasAiText,
} from "@/lib/block-conversions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import ShapeBlock from "./block-editors/ShapeBlock";
import ChartBlock from "./block-editors/ChartBlock";
import FormulaBlock from "./block-editors/FormulaBlock";
import AudioBlock from "./block-editors/AudioBlock";
import VideoBlock from "./block-editors/VideoBlock";

// --- Categorization: card visuals (Step 1) ---
type CategoryKey = "text" | "media" | "structure" | "interactive";

const CARD_CATEGORY: Record<string, CategoryKey> = {
  heading: "text", paragraph: "text", bullet_list: "text",
  quote: "text", callout: "text", summary: "text",
  image: "media", image_text: "media", gallery: "media", youtube: "media",
  audio: "media", video: "media",
  shape: "structure", chart: "structure", formula: "text",
  card_grid: "structure", table: "structure", two_column: "structure",
  hierarchy: "structure", accordion: "structure", divider: "structure",
  activity: "interactive", lesson_link: "interactive",
  slide_group: "structure",
};

const CATEGORY_STYLES: Record<CategoryKey, {
  border: string; headerBg: string; iconColor: string; labelColor: string;
  borderWidth: number; solid?: boolean;
}> = {
  text:        { border: "hsl(var(--border))", headerBg: "hsl(var(--card))", iconColor: "hsl(var(--muted-foreground))", labelColor: "hsl(var(--muted-foreground))", borderWidth: 1 },
  media:       { border: "hsl(var(--primary-pastel))", headerBg: "hsl(var(--primary-subtle))", iconColor: "hsl(var(--primary))", labelColor: "hsl(var(--primary-dark))", borderWidth: 1 },
  structure:   { border: "hsl(var(--secondary-pastel))", headerBg: "hsl(var(--secondary-pastel))", iconColor: "hsl(var(--secondary-dark))", labelColor: "hsl(var(--secondary-dark))", borderWidth: 1 },
  interactive: { border: "hsl(var(--primary))", headerBg: "hsl(var(--primary))", iconColor: "#FFFFFF", labelColor: "#FFFFFF", borderWidth: 1.5, solid: true },
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
  shape: IconSquare,
  chart: IconBarChart,
  formula: IconSigma,
  audio: IconVolume2,
  video: IconVideo,
  slide_group: IconGroup,
};

// --- Add-menu grouping (Step 2) ---
const MENU_GROUPS: { key: CategoryKey; label: string; types: string[]; accent?: boolean }[] = [
  { key: "text", label: "Text", types: ["heading", "paragraph", "bullet_list", "quote", "callout", "formula"] },
  { key: "media", label: "Média", types: ["image", "image_text", "gallery", "youtube", "video", "audio"] },
  { key: "structure", label: "Struktura a rozložení", types: ["card_grid", "table", "two_column", "hierarchy", "accordion", "shape", "chart", "divider"] },
  { key: "interactive", label: "Interaktivní a AI", types: ["activity", "summary", "lesson_link"], accent: true },
];

const MENU_AI_BADGE = new Set(["activity", "summary"]);
const CARD_AI_BADGE = new Set(["activity"]);

export interface BlockEditorHistory {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  /** Optional actions rendered on the right side of the sticky toolbar. */
  toolbarActions?: React.ReactNode;
  /** Hide the internal sticky toolbar (undo/redo rendered elsewhere). */
  hideToolbar?: boolean;
  /** Exposes undo/redo controls so they can be rendered in an external toolbar. */
  onHistoryChange?: (history: BlockEditorHistory) => void;
  /** Id bloků navržených AI – zobrazí se u nich badge „Navrženo AI – zkontrolujte“. */
  aiSuggestedIds?: string[];
  /** Voláno, když uživatel blok ručně upraví (badge pak zmizí). */
  onBlockEdited?: (id: string) => void;
}



const BlockRenderer = React.memo(({ block, onChange, showControls = true }: { block: Block; onChange: (props: Record<string, any>) => void; showControls?: boolean }) => {
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
    case "divider": return <DividerBlock block={block} onChange={onChange} showControls={showControls} />;
    case "two_column": return <TwoColumnBlock block={block} onChange={onChange} />;
    case "gallery": return <GalleryBlock block={block} onChange={onChange} />;
    case "summary": return <SummaryBlock block={block} onChange={onChange} />;
    case "activity": return <ActivityBlock block={block} onChange={onChange} />;
    case "hierarchy": return <HierarchyBlock block={block} onChange={onChange} />;
    case "shape": return <ShapeBlock block={block} onChange={onChange} />;
    case "chart": return <ChartBlock block={block} onChange={onChange} />;
    case "formula": return <FormulaBlock block={block} onChange={onChange} />;
    case "audio": return <AudioBlock block={block} onChange={onChange} />;
    case "video": return <VideoBlock block={block} onChange={onChange} />;
    default: return <p className="text-muted-foreground text-sm">Neznámý blok</p>;
  }
});
BlockRenderer.displayName = "BlockRenderer";

/** Editor jednoho bloku (bez seznamu) – použito v panelu editoru prezentací. */
export const SingleBlockEditor = BlockRenderer;

/**
 * Blok uvnitř spojeného snímku (`slide_group`) – hlavička s typem, tlačítkem
 * vlastností (velikost, font, pozadí) a vyjmutím; obsah respektuje pozadí bloku.
 * Používá se v obou režimech skupiny (Sloupce i Volné rozmístění).
 */
const GroupChildBlock = ({
  child,
  onChange,
  onRemove,
}: {
  child: Block;
  onChange: (props: Record<string, any>) => void;
  onRemove: () => void;
}) => {
  const [propsOpen, setPropsOpen] = useState(false);
  const ChildIcon = BLOCK_ICON[child.type];
  const childLabel = BLOCK_TYPES.find((t) => t.type === child.type)?.label ?? child.type;
  const isText = INLINE_TEXT_TYPES.has(child.type);
  const bgStyle = blockBackgroundStyle(child.props);

  return (
    <>
      <div className="mb-1.5 flex items-center gap-1.5">
        {ChildIcon && <ChildIcon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="flex-1 text-[11px] font-bold text-muted-foreground">{childLabel}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPropsOpen((v) => !v)}
          aria-pressed={propsOpen}
          aria-label={`Vlastnosti bloku ${childLabel}`}
          title="Vlastnosti bloku (velikost, font, pozadí)"
          className={`inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted ${
            propsOpen ? "bg-muted text-foreground" : "text-muted-foreground"
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
          title="Vyjmout ze snímku"
        >
          <IconX className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {propsOpen && (
        <div
          className="mb-2 rounded-md border border-border bg-background p-2 shadow-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <BlockStyleControls block={child} onChange={onChange} showText={isText} compact />
        </div>
      )}

      <div onPointerDown={(e) => e.stopPropagation()}>
        <div style={bgStyle}>
          <BlockRenderer block={child} onChange={onChange} />
        </div>
      </div>
    </>
  );
};

/**
 * Karta dítěte v režimu „Sloupce“ – šířku určuje mřížka, výšku lze
 * ručně nastavit tažením za spodní okraj (uloží se do `props.groupHeight`).
 */
const ColumnGroupCard = ({
  child,
  onChange,
  onRemove,
  onHeightChange,
}: {
  child: Block;
  onChange: (props: Record<string, any>) => void;
  onRemove: () => void;
  onHeightChange: (height: number | null) => void;
}) => {
  const saved = getGroupChildHeight(child);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const height = dragHeight ?? saved;

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = cardRef.current?.getBoundingClientRect().height ?? GROUP_CHILD_MIN_HEIGHT;
    const clamp = (v: number) =>
      Math.min(GROUP_CHILD_MAX_HEIGHT, Math.max(GROUP_CHILD_MIN_HEIGHT, Math.round(v)));
    let last = clamp(startH);
    const move = (ev: PointerEvent) => {
      last = clamp(startH + (ev.clientY - startY));
      setDragHeight(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragHeight(null);
      onHeightChange(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={cardRef}
      className="relative rounded-[10px] border border-border bg-[#FAFAFA] p-2 pb-4 min-w-0"
      style={height ? { minHeight: height } : undefined}
    >
      <GroupChildBlock child={child} onChange={onChange} onRemove={onRemove} />
      <div
        role="separator"
        aria-label="Změnit výšku karty"
        title="Tažením změníte výšku karty, dvojklikem vrátíte automatickou výšku"
        onPointerDown={startResize}
        onDoubleClick={() => onHeightChange(null)}
        className="absolute bottom-0 left-0 right-0 flex h-3 cursor-ns-resize items-center justify-center rounded-b-[10px] hover:bg-primary/10"
      >
        <span className="h-1 w-8 rounded-full bg-border" />
      </div>
    </div>
  );
};

type ReplaceHandler = (
  id: string,
  target: Block["type"],
  extras?: Record<string, any>,
) => void;

const ReplaceMenu = ({
  block,
  loading,
  onReplace,
  onAiReplace,
}: {
  block: Block;
  loading: boolean;
  onReplace: (target: Block["type"]) => void;
  onAiReplace: (target: "activity" | "hierarchy") => void;
}) => {
  const [open, setOpen] = useState(false);
  const formatTargets = (FORMAT_TARGETS[block.type] ?? []).filter(
    (t) => t !== block.type,
  );
  const hasAiText = blockHasAiText(block);
  const hasAny = formatTargets.length > 0 || hasAiText;
  if (!hasAny) return null;

  const cat = CATEGORY_STYLES[CARD_CATEGORY[block.type] ?? "text"];
  const btnColor = cat.solid ? "rgba(255,255,255,0.85)" : "#737373";
  const btnHoverColor = cat.solid ? "#FFFFFF" : "#525252";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className="be-block__action be-block__replace inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors disabled:opacity-60"
          title="Změnit na…"
          style={{ color: btnColor }}
          onMouseEnter={(e) => (e.currentTarget.style.color = btnHoverColor)}
          onMouseLeave={(e) => (e.currentTarget.style.color = btnColor)}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRightLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-0 overflow-hidden">
        <div className="w-[240px] py-1">
          {formatTargets.length > 0 && (
            <>
              <div
                className="px-3 pt-2 pb-1"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "#A3A3A3",
                }}
              >
                Formát
              </div>
              {formatTargets.map((t) => {
                const meta = BLOCK_TYPES.find((bt) => bt.type === t);
                const Icon = BLOCK_ICON[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onReplace(t);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-[#F5F5F5] transition-colors text-left"
                    style={{ color: "#171717" }}
                  >
                    {Icon && <Icon className="w-4 h-4 text-[#525252]" />}
                    <span className="flex-1">{meta?.label ?? t}</span>
                  </button>
                );
              })}
            </>
          )}
          {hasAiText && (
            <>
              <div
                className="px-3 pt-2 pb-1"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "hsl(var(--primary-dark))",
                }}
              >
                Vytvořit z obsahu
              </div>
              {block.type !== "activity" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAiReplace("activity");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-primary-subtle transition-colors text-left"
                  style={{ color: "#171717" }}
                >
                  <IconSparkles className="w-4 h-4" style={{ color: "hsl(var(--primary-dark))" }} />
                  <span className="flex-1">Aktivita</span>
                  <span
                    style={{
                      background: "hsl(var(--primary))",
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
                </button>
              )}
              {block.type !== "hierarchy" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAiReplace("hierarchy");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-primary-subtle transition-colors text-left"
                  style={{ color: "#171717" }}
                >
                  <IconTriangle className="w-4 h-4" style={{ color: "hsl(var(--primary-dark))" }} />
                  <span className="flex-1">Hierarchie</span>
                  <span
                    style={{
                      background: "hsl(var(--primary))",
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
                </button>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Textové bloky, které se edituji přímo v náhledu. */
const INLINE_TEXT_TYPES = new Set(["heading", "paragraph", "bullet_list"]);

const SortableBlock = React.memo(({
  block,
  onUpdate,
  onDuplicate,
  onToggle,
  onDelete,
  onReplace,
  onAiReplace,
  replaceLoading,
  aiSuggested,
  selected,
  onSelectToggle,
}: {
  block: Block;
  onUpdate: (id: string, props: Record<string, any>) => void;
  onDuplicate: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReplace: (id: string, target: Block["type"]) => void;
  onAiReplace: (id: string, target: "activity" | "hierarchy") => void;
  replaceLoading: boolean;
  aiSuggested?: boolean;
  selected?: boolean;
  onSelectToggle?: (id: string, shift: boolean) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);

  const typeLabel = BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type;
  const handleUpdate = useCallback((props: Record<string, any>) => onUpdate(block.id, props), [onUpdate, block.id]);

  const Icon = BLOCK_ICON[block.type];
  const isText = INLINE_TEXT_TYPES.has(block.type);
  const showChrome = hover || !!selected || editing || propsOpen;
  const showProps = propsOpen || (isText && editing);
  const bgStyle = blockBackgroundStyle(block.props);

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: selected
      ? "hsl(var(--primary))"
      : showChrome
        ? "hsl(var(--border))"
        : "transparent",
    background: "transparent",
    boxShadow: selected ? "0 0 0 3px hsl(var(--primary) / 0.15)" : "none",
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        wrapRef.current = node;
      }}
      data-block-id={block.id}
      data-be-selectable="true"
      style={wrapperStyle}
      className={`be-block group/beblock ${!block.visible ? "opacity-50" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        window.setTimeout(() => {
          const w = wrapRef.current;
          if (!w) return;
          if (w.contains(document.activeElement)) return;
          if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
          setEditing(false);
        }, 150);
      }}
    >
      {/* Plovoucí lišta vedle bloku – jen při hoveru / výběru / editaci. */}
      {(
        <div
          className={`absolute -top-3.5 right-2 z-30 flex items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5 shadow-md transition-opacity ${showChrome ? "opacity-100" : "opacity-0"}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {Icon && (
            <span title={typeLabel} className="inline-flex">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          )}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab p-0.5 text-muted-foreground hover:text-foreground"
            title="Přetáhnout blok"
            aria-label={`Přetáhnout blok ${typeLabel}`}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelectToggle?.(block.id, (e.nativeEvent as any)?.shiftKey === true)}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 cursor-pointer accent-[hsl(var(--primary))]"
            title="Vybrat blok (Shift+klik vybere rozsah)"
            aria-label={`Vybrat blok ${typeLabel}`}
          />
          <ReplaceMenu
            block={block}
            loading={replaceLoading}
            onReplace={(target) => onReplace(block.id, target)}
            onAiReplace={(target) => onAiReplace(block.id, target)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="be-block__action inline-flex h-6 w-6 items-center justify-center rounded"
                title="Další možnosti"
                aria-label={`Možnosti bloku ${typeLabel}`}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setPropsOpen((v) => !v)}>
                <Palette className="mr-2 h-4 w-4" /> Vlastnosti bloku
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(block.id)}>
                <Copy className="mr-2 h-4 w-4" /> Duplikovat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(block.id)}>
                {block.visible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {block.visible ? "Skrýt pro žáky" : "Zobrazit žákům"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(block.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Smazat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {aiSuggested && (
        <span
          title="Tento obsah navrhla umělá inteligence. Zkontrolujte ho a upravte."
          className="absolute -top-3 left-2 z-20 inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-dark whitespace-nowrap"
        >
          <span aria-hidden="true">🤖</span> Navrženo AI
        </span>
      )}

      {/* Lišta vlastností – plovoucí nad blokem, na mobilu přilepená dole. */}
      {showProps && (
        <div
          className={
            isMobile
              ? "fixed bottom-[56px] left-0 right-0 z-50 overflow-x-auto border-t border-border bg-background px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
              : "absolute bottom-full right-0 z-40 mb-10 rounded-md border border-border bg-background p-2 shadow-lg"
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          <BlockStyleControls
            block={block}
            onChange={handleUpdate}
            showText={isText}
            compact
          />
        </div>
      )}

      <div className="px-1 py-1" style={{ color: "#171717" }}>
        <div style={bgStyle}>
          <BlockRenderer block={block} onChange={handleUpdate} showControls={showChrome} />
        </div>
      </div>
    </div>
  );
});
SortableBlock.displayName = "SortableBlock";

/** Karta spojených bloků – v prezentaci z nich vznikne jeden snímek. */
const SortableSlideGroup = React.memo(({
  block,
  onChildUpdate,
  onChildRemove,
  onLayoutChange,
  onModeChange,
  onChildFrameChange,
  onChildHeightChange,
  onMinHeightChange,

  onUngroup,
  onToggle,
  onDelete,
  selected,
  onSelectToggle,
}: {
  block: Block;
  onChildUpdate: (groupId: string, childId: string, props: Record<string, any>) => void;
  onChildRemove: (groupId: string, childId: string) => void;
  onLayoutChange: (groupId: string, layout: SlideGroupLayout) => void;
  onModeChange: (groupId: string, mode: SlideGroupMode) => void;
  onChildFrameChange: (groupId: string, childId: string, frame: BlockFrame) => void;
  onChildHeightChange: (groupId: string, childId: string, height: number | null) => void;
  onMinHeightChange: (groupId: string, height: number | null) => void;

  onUngroup: (groupId: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  selected?: boolean;
  onSelectToggle?: (id: string, shift: boolean) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const children = getGroupChildren(block);
  const layout = getGroupLayout(block);
  const mode = getGroupMode(block);
  const frames = getGroupChildFrames(block);
  const [activeChild, setActiveChild] = useState<string | null>(null);

  // Ruční minimální výška celého snímku (tažení za spodní okraj kontejneru).
  const savedMinHeight = getGroupMinHeight(block);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [dragMinHeight, setDragMinHeight] = useState<number | null>(null);
  const minHeight = dragMinHeight ?? savedMinHeight;

  const startGroupResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = groupRef.current?.getBoundingClientRect().height ?? GROUP_MIN_HEIGHT;
    const clamp = (v: number) =>
      Math.min(GROUP_MAX_HEIGHT, Math.max(GROUP_MIN_HEIGHT, Math.round(v)));
    let last = clamp(startH);
    const move = (ev: PointerEvent) => {
      last = clamp(startH + (ev.clientY - startY));
      setDragMinHeight(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragMinHeight(null);
      onMinHeightChange(block.id, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };


  const gridClass =
    layout === 3
      ? "grid grid-cols-1 md:grid-cols-3 gap-3"
      : layout === 2
        ? "grid grid-cols-1 md:grid-cols-2 gap-3"
        : "space-y-3";


  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderRadius: 14,
    borderWidth: selected ? 2 : 1.5,
    borderStyle: "solid",
    borderColor: selected ? "hsl(var(--primary))" : "hsl(var(--secondary-dark))",
    background: "#FFFFFF",
    boxShadow: selected
      ? "0 0 0 3px hsl(var(--primary) / 0.18)"
      : "0 1px 3px hsl(228 24% 92% / 0.6), 0 4px 16px -4px hsl(228 24% 92% / 0.4)",
  };

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      data-be-selectable="true"
      data-category="structure"
      style={wrapperStyle}
      className={`be-block group/beblock overflow-visible ${!block.visible ? "opacity-50" : ""}`}
    >
      <div
        className="be-block__header flex items-center gap-2 px-3 py-2 flex-wrap rounded-t-[13px]"
        style={{ background: "hsl(var(--secondary-pastel))", borderBottom: "1px solid #F0F0F0" }}
      >
        <button {...attributes} {...listeners} className="be-block__grip cursor-grab p-0.5" style={{ color: "#737373" }}>
          <GripVertical className="w-4 h-4" />
        </button>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelectToggle?.(block.id, (e.nativeEvent as any)?.shiftKey === true)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 cursor-pointer accent-[hsl(var(--primary))]"
          aria-label="Vybrat snímek"
        />
        <IconGroup className="w-4 h-4" style={{ color: "hsl(var(--secondary-dark))" }} />
        <button
          type="button"
          onClick={(e) => onSelectToggle?.(block.id, e.shiftKey)}
          className="be-block__label text-left"
          style={{ color: "hsl(var(--secondary-dark))", fontWeight: 700, fontSize: 12 }}
        >
          Snímek
        </button>
        <span className="text-[11px] text-muted-foreground">
          {children.length} bloků · jeden snímek prezentace
        </span>

        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center rounded-md border border-border overflow-hidden mr-1" role="group" aria-label="Režim rozvržení">
            {([["columns", "Sloupce"], ["free", "Volné rozmístění"]] as [SlideGroupMode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(block.id, m)}
                aria-pressed={mode === m}
                title={label}
                className="h-7 px-2 text-[11px] font-bold transition-colors"
                style={{
                  background: mode === m ? "hsl(var(--primary))" : "#FFFFFF",
                  color: mode === m ? "#FFFFFF" : "#525252",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "columns" && (
            <div className="flex items-center rounded-md border border-border overflow-hidden mr-1" role="group" aria-label="Počet sloupců">
              {([1, 2, 3] as SlideGroupLayout[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onLayoutChange(block.id, n)}
                  aria-pressed={layout === n}
                  title={n === 1 ? "Pod sebou" : `${n} sloupce`}
                  className="h-7 w-7 text-xs font-bold transition-colors"
                  style={{
                    background: layout === n ? "hsl(var(--primary))" : "#FFFFFF",
                    color: layout === n ? "#FFFFFF" : "#525252",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onUngroup(block.id)} title="Rozdělit na jednotlivé bloky">
            <IconUngroup className="w-3.5 h-3.5" /> Rozdělit
          </Button>
          <Button size="icon" variant="ghost" className="be-block__action h-7 w-7" onClick={() => onToggle(block.id)} title={block.visible ? "Skrýt" : "Zobrazit"}>
            {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="be-block__action h-7 w-7" onClick={() => onDelete(block.id)} title="Smazat celý snímek">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-3" style={{ color: "#171717" }}>
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">Snímek je prázdný – rozdělte ho zpět.</p>
        ) : mode === "free" ? (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Bloky přesouvejte tažením, velikost změníte tažením za rohy. Alt = mřížka po 1 %.
            </p>
            <FreeFrameCanvas
              items={children.map((child) => ({
                id: child.id,
                frame: frames[child.id],
                node: (
                  <div className="h-full w-full overflow-auto rounded-[8px] border border-border bg-white p-2 min-w-0">
                    <GroupChildBlock
                      child={child}
                      onChange={(props) => onChildUpdate(block.id, child.id, props)}
                      onRemove={() => onChildRemove(block.id, child.id)}
                    />
                  </div>
                ),
              }))}
              selectedId={activeChild}
              onSelect={setActiveChild}
              onChangeFrame={(childId, frame) => onChildFrameChange(block.id, childId, frame)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Výšku karty upravíte tažením za její spodní okraj, dvojklik na okraj vrátí automatickou výšku.
            </p>
            <div className={`${gridClass} items-start`}>
              {children.map((child) => (
                <ColumnGroupCard
                  key={child.id}
                  child={child}
                  onChange={(props) => onChildUpdate(block.id, child.id, props)}
                  onRemove={() => onChildRemove(block.id, child.id)}
                  onHeightChange={(h) => onChildHeightChange(block.id, child.id, h)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
});
SortableSlideGroup.displayName = "SortableSlideGroup";



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
          const headingColor = group.accent ? "hsl(var(--primary-dark))" : "#A3A3A3";
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
                const iconColor = group.accent ? "hsl(var(--primary-dark))" : "#525252";
                return (
                  <button
                    key={bt.type}
                    type="button"
                    onClick={() => onPick(bt.type as Block["type"])}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md hover:bg-[#F5F5F5] transition-colors"
                    style={{
                      color: "#171717",
                      background: isAi ? "hsl(var(--primary-subtle))" : "transparent",
                    }}
                  >
                    {Icon && <Icon className="w-4 h-4" style={{ color: iconColor }} />}
                    <span className="flex-1 text-left">{bt.label}</span>
                    {isAi && (
                      <span
                        style={{
                          background: "hsl(var(--primary))",
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

const AddBlockMenu = ({ onPick }: { onPick: (type: Block["type"]) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="be-add-primary">
          <Plus className="w-4 h-4" /> Přidat blok
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="p-0 overflow-hidden">
        <BlockPicker
          onPick={(type) => {
            onPick(type);
            setOpen(false);
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


const BlockEditor = ({ blocks, onChange, toolbarActions, hideToolbar, onHistoryChange, aiSuggestedIds, onBlockEdited }: Props) => {
  const aiSuggestedSet = useMemo(() => new Set(aiSuggestedIds ?? []), [aiSuggestedIds]);
  const onBlockEditedRef = useRef(onBlockEdited);
  onBlockEditedRef.current = onBlockEdited;
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

  const historyCbRef = useRef(onHistoryChange);
  historyCbRef.current = onHistoryChange;
  useEffect(() => {
    historyCbRef.current?.({ undo, redo, canUndo, canRedo });
  }, [undo, redo, canUndo, canRedo]);



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
    onBlockEditedRef.current?.(id);
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

  const [replacingId, setReplacingId] = useState<string | null>(null);

  const replaceBlock = useCallback((id: string, target: Block["type"]) => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const src = cur[idx];
    if (src.type === target) return;
    const converted = convertBlock(src, target);
    if (!converted) {
      toast.error("Tento typ bloku nelze převést na zvolený formát.");
      return;
    }
    const fresh = createDefaultBlock(target);
    const nextBlock: Block = {
      ...fresh,
      id: src.id,
      visible: src.visible,
      props: { ...fresh.props, ...converted },
    };
    const next = [...cur];
    next[idx] = nextBlock;
    commit(next);
  }, [commit]);

  const aiReplaceBlock = useCallback(async (id: string, target: "activity" | "hierarchy") => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const src = cur[idx];
    const text = blockToPlainText(src).trim();
    if (text.length < 8) {
      toast.error("Blok neobsahuje dost textu pro AI transformaci.");
      return;
    }

    setReplacingId(id);
    try {
      if (target === "hierarchy") {
        const { data, error } = await supabase.functions.invoke("generate-hierarchy", {
          body: { text },
        });
        if (error) throw error;
        const hierarchy = (data as any)?.hierarchy;
        if (!hierarchy?.levels?.length) throw new Error("AI nevrátila platnou hierarchii");
        const fresh = createDefaultBlock("hierarchy");
        const nextBlock: Block = {
          ...fresh,
          id: src.id,
          visible: src.visible,
          props: { ...fresh.props, ...hierarchy },
        };
        const cur2 = blocksRef.current;
        const idx2 = cur2.findIndex((b) => b.id === id);
        if (idx2 < 0) return;
        const next = [...cur2];
        next[idx2] = nextBlock;
        commit(next);
        toast.success("Blok převeden na hierarchii.");
      } else {
        const { data, error } = await supabase.functions.invoke("generate-activity-from-text", {
          body: { text },
        });
        if (error) throw error;
        const activity = (data as any)?.activity;
        if (!activity?.quiz?.question || !Array.isArray(activity?.quiz?.answers)) {
          throw new Error("AI nevrátila platnou aktivitu");
        }
        const fresh = createDefaultBlock("activity");
        const nextBlock: Block = {
          ...fresh,
          id: src.id,
          visible: src.visible,
          props: {
            ...fresh.props,
            activityType: "quiz",
            title: activity.title || "Aktivita",
            quiz: activity.quiz,
          },
        };
        const cur2 = blocksRef.current;
        const idx2 = cur2.findIndex((b) => b.id === id);
        if (idx2 < 0) return;
        const next = [...cur2];
        next[idx2] = nextBlock;
        commit(next);
        toast.success("Blok převeden na aktivitu. Zkontrolujte prosím obsah.");
      }
    } catch (e: any) {
      console.error("aiReplaceBlock failed:", e);
      const msg = e?.message?.includes("402")
        ? "Nedostatek AI kreditů."
        : e?.message?.includes("429")
          ? "Příliš mnoho AI požadavků, zkuste to za chvíli."
          : "AI transformace se nezdařila. Zkuste to znovu.";
      toast.error(msg);
    } finally {
      setReplacingId(null);
    }
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

  // --- Multi-výběr bloků (Shift+klik, tažení rámečku) ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastPickedRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Výběr se čistí, když vybraný blok zmizí (smazání, spojení, undo).
  useEffect(() => {
    setSelectedIds((prev) => {
      const alive = prev.filter((id) => normalizedBlocks.some((b) => b.id === id));
      return alive.length === prev.length ? prev : alive;
    });
  }, [normalizedBlocks]);

  const toggleSelect = useCallback((id: string, shift: boolean) => {
    const cur = blocksRef.current;
    setSelectedIds((prev) => {
      if (shift && lastPickedRef.current) {
        const a = cur.findIndex((b) => b.id === lastPickedRef.current);
        const b2 = cur.findIndex((b) => b.id === id);
        if (a >= 0 && b2 >= 0) {
          const [from, to] = a < b2 ? [a, b2] : [b2, a];
          const range = cur.slice(from, to + 1).map((b) => b.id);
          return Array.from(new Set([...prev, ...range]));
        }
      }
      lastPickedRef.current = id;
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
    if (!shift) lastPickedRef.current = id;
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  /** Tažení rámečku po prázdné ploše editoru vybere bloky, které rámeček protne. */
  const handleMarqueeStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    const target = e.target as HTMLElement;
    // Startujeme jen na prázdné ploše, ne uvnitř karty bloku ani na tlačítku.
    if (target.closest("[data-be-selectable='true']") || target.closest("button, input, textarea, a, [contenteditable='true']")) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const x = Math.min(startX, ev.clientX);
      const y = Math.min(startY, ev.clientY);
      const w = Math.abs(ev.clientX - startX);
      const h = Math.abs(ev.clientY - startY);
      if (w > 4 || h > 4) moved = true;
      if (!moved) return;
      setMarquee({ x: x - rect.left, y: y - rect.top, w, h });

      const box = { left: x, top: y, right: x + w, bottom: y + h };
      const hit: string[] = [];
      container.querySelectorAll("[data-be-selectable='true']").forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const overlaps = r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
        if (overlaps) {
          const id = (el as HTMLElement).dataset.blockId;
          if (id) hit.push(id);
        }
      });
      setSelectedIds(hit);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved) setSelectedIds([]);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // --- Spojování bloků do snímku ---
  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const ordered = blocksRef.current.filter((b) => selectedIds.includes(b.id)).map((b) => b.id);
    commit(groupBlocksIntoSlide(blocksRef.current, ordered, 2));
    setSelectedIds([]);
    lastPickedRef.current = null;
    toast.success("Bloky spojeny do jednoho snímku.");
  }, [commit, selectedIds]);

  const ungroup = useCallback((groupId: string) => {
    commit(ungroupSlideGroup(blocksRef.current, groupId));
    setSelectedIds([]);
    toast.success("Snímek rozdělen na jednotlivé bloky.");
  }, [commit]);

  const changeGroupLayout = useCallback((groupId: string, layout: SlideGroupLayout) => {
    commit(setGroupLayout(blocksRef.current, groupId, layout));
  }, [commit]);

  const changeGroupMode = useCallback((groupId: string, mode: SlideGroupMode) => {
    commit(setGroupMode(blocksRef.current, groupId, mode));
  }, [commit]);

  const changeChildFrame = useCallback((groupId: string, childId: string, frame: BlockFrame) => {
    commit(setGroupChildFrame(blocksRef.current, groupId, childId, frame));
  }, [commit]);

  const changeChildHeight = useCallback((groupId: string, childId: string, height: number | null) => {
    commit(setGroupChildHeight(blocksRef.current, groupId, childId, height));
  }, [commit]);


  const updateChild = useCallback((groupId: string, childId: string, props: Record<string, any>) => {
    onBlockEditedRef.current?.(childId);
    commit(updateGroupChild(blocksRef.current, groupId, childId, props));
  }, [commit]);

  const removeChild = useCallback((groupId: string, childId: string) => {
    commit(removeChildFromGroup(blocksRef.current, groupId, childId));
  }, [commit]);



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
      ref={containerRef}
      onPointerDown={handleMarqueeStart}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => {
        // Only clear when leaving the wrapper itself
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
      className={`block-editor-scope relative w-full max-w-none space-y-2 px-2 py-4 md:px-6 rounded-[14px] transition ${dragOver ? "ring-2 ring-offset-2 bg-primary/5" : ""}`}
      style={{ background: "hsl(var(--background))" }}
    >

      <style>{`
        .block-editor-scope .be-block[data-category="interactive"] .be-block__action { color: rgba(255,255,255,0.85); }
        .block-editor-scope .be-block[data-category="interactive"] .be-block__action:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }
        .block-editor-scope .be-block__action { color: #A3A3A3; }
        .block-editor-scope .be-block__action:hover { color: #525252; background: #F5F5F5; }
        .block-editor-scope .be-add-primary {
          background: hsl(var(--primary)); color: #FFFFFF; border-radius: 24px;
          padding: 0 20px; height: 40px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 8px;
          border: none; transition: background 120ms ease, transform 120ms ease;
        }
        .block-editor-scope .be-add-primary:hover { background: hsl(var(--primary-dark)); }
        .block-editor-scope { font-family: 'Lato', system-ui, sans-serif; font-size: 16px; line-height: 1.5; }
        .block-editor-scope .be-block__label { font-size: 14px; font-weight: 700; letter-spacing: 0.01em; }
        .block-editor-scope .be-block h1, .block-editor-scope .be-block [data-heading="1"] { font-size: 32px; font-weight: 700; line-height: 1.2; }
        .block-editor-scope .be-block h2, .block-editor-scope .be-block [data-heading="2"] { font-size: 24px; font-weight: 700; line-height: 1.25; }
        .block-editor-scope .be-block h3, .block-editor-scope .be-block [data-heading="3"] { font-size: 20px; font-weight: 700; line-height: 1.3; }
        .block-editor-scope .be-block h4, .block-editor-scope .be-block [data-heading="4"] { font-size: 18px; font-weight: 700; line-height: 1.35; }
        .block-editor-scope .be-block p, .block-editor-scope .be-block li { font-size: 16px; font-weight: 400; line-height: 1.5; }
        .block-editor-scope .be-block figcaption, .block-editor-scope .be-block .caption { font-size: 14px; color: #737373; }
      `}</style>


      {!hideToolbar && (
      <div className="flex items-center gap-1 flex-wrap sticky top-0 z-40 -mx-4 -mt-4 mb-1 px-4 py-2 bg-background/90 backdrop-blur-sm border-b border-border/60 shadow-sm rounded-t-[14px]">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={undo}
          disabled={!canUndo}
          title="Zpět (Ctrl/Cmd+Z)"
          aria-label="Zpět"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={redo}
          disabled={!canRedo}
          title="Vpřed (Ctrl/Cmd+Shift+Z)"
          aria-label="Vpřed"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        {toolbarActions && (
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">{toolbarActions}</div>
        )}
      </div>
      )}

      {selectedIds.length > 0 && (
        <div className="sticky top-12 z-40 flex items-center gap-2 flex-wrap rounded-[12px] border border-primary/30 bg-primary-subtle px-3 py-2">
          <span className="text-sm font-bold text-primary-dark">
            Vybráno bloků: {selectedIds.length}
          </span>
          <span className="text-xs text-muted-foreground">
            Shift+klik vybere rozsah, tažením po ploše vyberete rámečkem.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={groupSelected} disabled={selectedIds.length < 2}>
              <IconGroup className="w-4 h-4" /> Spojit do jednoho snímku
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>Zrušit výběr</Button>
          </div>
        </div>
      )}

      {marquee && (
        <div
          className="absolute z-50 pointer-events-none rounded-sm border-2 border-primary bg-primary/10"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

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
              {isSlideGroup(block) ? (
                <SortableSlideGroup
                  block={block}
                  onChildUpdate={updateChild}
                  onChildRemove={removeChild}
                  onLayoutChange={changeGroupLayout}
                  onModeChange={changeGroupMode}
                  onChildFrameChange={changeChildFrame}
                  onChildHeightChange={changeChildHeight}

                  onUngroup={ungroup}
                  onToggle={toggleBlock}
                  onDelete={deleteBlock}
                  selected={selectedIds.includes(block.id)}
                  onSelectToggle={toggleSelect}
                />
              ) : (
                <SortableBlock
                  block={block}
                  onUpdate={updateBlock}
                  onDuplicate={duplicateBlock}
                  onToggle={toggleBlock}
                  onDelete={deleteBlock}
                  onReplace={replaceBlock}
                  onAiReplace={aiReplaceBlock}
                  replaceLoading={replacingId === block.id}
                  aiSuggested={aiSuggestedSet.has(block.id)}
                  selected={selectedIds.includes(block.id)}
                  onSelectToggle={toggleSelect}
                />
              )}
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
        <AddBlockMenu onPick={(type) => addBlock(type)} />
      </div>


    </div>
  );
};

export default BlockEditor;
