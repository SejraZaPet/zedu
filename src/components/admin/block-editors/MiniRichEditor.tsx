import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, Heading4,
  AlignLeft, AlignCenter, AlignRight, Highlighter,
  Palette, X,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useRef, useState } from "react";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  showHeadings?: boolean;
  showLists?: boolean;
  showAlign?: boolean;
}

const TB = ({
  active, onClick, children, title,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1 rounded transition-colors ${
      active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const COLOR_GROUPS: { label: string; colors: { name: string; value: string }[] }[] = [
  {
    label: "Neutrální",
    colors: [
      { name: "Černá", value: "#000000" },
      { name: "Tmavě šedá", value: "#4a4a4a" },
      { name: "Šedá", value: "#8c8c8c" },
      { name: "Světle šedá", value: "#c8c8c8" },
      { name: "Bílá", value: "#f2f0eb" },
    ],
  },
  {
    label: "Hlavní",
    colors: [
      { name: "Červená", value: "#dc2626" },
      { name: "Oranžová", value: "#ea580c" },
      { name: "Žlutá", value: "#ca8a04" },
      { name: "Zelená", value: "#16a34a" },
      { name: "Modrá", value: "#2563eb" },
      { name: "Fialová", value: "#9333ea" },
    ],
  },
  {
    label: "Světlé",
    colors: [
      { name: "Světle modrá", value: "#60a5fa" },
      { name: "Světle zelená", value: "#4ade80" },
      { name: "Světle oranžová", value: "#fb923c" },
      { name: "Růžová", value: "#f472b6" },
      { name: "Lila", value: "#c084fc" },
      { name: "Tyrkysová", value: "#22d3ee" },
    ],
  },
];

const MiniRichEditor = ({
  content,
  onChange,
  placeholder = "Začněte psát…",
  minHeight = "80px",
  showHeadings = false,
  showLists = true,
  showAlign = true,
}: Props) => {
  const skipUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      if (!skipUpdate.current) {
        onChange(e.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: `prose prose-invert prose-sm max-w-none focus:outline-none p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_mark]:bg-primary/30 [&_mark]:text-foreground`,
        style: `min-height:${minHeight}`,
      },
    },
  });

  // Sync external content changes without cursor jump
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      skipUpdate.current = true;
      editor.commands.setContent(content, { emitUpdate: false });
      skipUpdate.current = false;
    }
    // Only react to content prop changes, not editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  const sz = "w-3.5 h-3.5";

  return (
    <div className="border border-border rounded-md overflow-hidden bg-background">
      <div className="flex flex-wrap gap-0.5 px-1 py-1 border-b border-border bg-muted/30">
        <TB active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Tučné">
          <Bold className={sz} />
        </TB>
        <TB active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Kurzíva">
          <Italic className={sz} />
        </TB>
        <TB active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Podtržení">
          <UnderlineIcon className={sz} />
        </TB>
        <TB active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Zvýraznění">
          <Highlighter className={sz} />
        </TB>

        {/* Text color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Barva textu" className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Palette className={sz} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[120px]">
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetColor().run()}>
              Výchozí
            </DropdownMenuItem>
            {TEXT_COLORS.map((c) => (
              <DropdownMenuItem key={c.label} onClick={() => editor.chain().focus().setColor(c.value).run()}>
                <span className="w-3 h-3 rounded-full mr-2 border border-border" style={{ backgroundColor: c.value }} />
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {showHeadings && (
          <>
            <div className="w-px bg-border mx-0.5" />
            <TB active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">
              <Heading1 className={sz} />
            </TB>
            <TB active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">
              <Heading2 className={sz} />
            </TB>
            <TB active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3">
              <Heading3 className={sz} />
            </TB>
            <TB active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="H4">
              <Heading4 className={sz} />
            </TB>
          </>
        )}

        {showLists && (
          <>
            <div className="w-px bg-border mx-0.5" />
            <TB active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Odrážky">
              <List className={sz} />
            </TB>
            <TB active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Číslování">
              <ListOrdered className={sz} />
            </TB>
          </>
        )}

        {showAlign && (
          <>
            <div className="w-px bg-border mx-0.5" />
            <TB active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Vlevo">
              <AlignLeft className={sz} />
            </TB>
            <TB active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Střed">
              <AlignCenter className={sz} />
            </TB>
            <TB active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Vpravo">
              <AlignRight className={sz} />
            </TB>
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default MiniRichEditor;
