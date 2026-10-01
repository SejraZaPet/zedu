import { useRef } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, Palette, X, Check, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotebookTextBox } from "@/lib/notebook";
import {
  NB_FONT_FAMILY, NB_FONT_SIZES, NB_LINE_HEIGHT, NotebookFontSize,
  sanitizeNotebookHtml, sizeToCqw, textBoxHtml,
} from "@/lib/notebook-rich-text";

interface Props {
  box: NotebookTextBox;
  toolbarTarget: HTMLElement | null;
  onChange: (html: string, text: string) => void;
  onDone: () => void;
  onRemove: () => void;
}

/** Psaní přímo v textovém bloku na stránce; lišta formátuje jen označený text. */
const NotebookTextEditor = ({ box, toolbarTarget, onChange, onDone, onRemove }: Props) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Poslední neprázdný výběr — nativní <select>/<input type=color> ukradnou fokus
  // a zruší DOM výběr, takže si ho pamatujeme a před formátováním obnovíme.
  const selRef = useRef<{ from: number; to: number } | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, bulletList: false, orderedList: false, listItem: false,
        blockquote: false, codeBlock: false, code: false, horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      NotebookFontSize,
      Placeholder.configure({ placeholder: "Piš sem…" }),
    ],
    content: textBoxHtml(box),
    autofocus: "end",
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(sanitizeNotebookHtml(e.getHTML()), e.getText({ blockSeparator: "\n" }));
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to } = e.state.selection;
      if (from !== to) selRef.current = { from, to };
    },
    editorProps: {
      attributes: {
        class: "notebook-rich-text block min-h-[1em] w-full min-w-0 max-w-none outline-none [&_p]:m-0 [&_p]:w-full [&_p]:max-w-none [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
        "aria-label": "Text na stránce sešitu",
      },
    },
  });


  if (!editor) return null;

  const currentSize = Number(editor.getAttributes("textStyle").fontSize) || box.fontSize;
  const currentColor = (editor.getAttributes("textStyle").color as string) || box.color;
  const currentBg = (editor.getAttributes("highlight").color as string) || "#FEF08A";
  const keep = (e: React.MouseEvent) => e.preventDefault(); // nezrušit výběr textu

  const toolbar = (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-2"
      onMouseDown={keep}
      role="toolbar"
      aria-label="Formátování označeného textu"
    >
      <Button type="button" size="icon" variant={editor.isActive("bold") ? "default" : "outline"} title="Tučně"
        onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant={editor.isActive("italic") ? "default" : "outline"} title="Kurzíva"
        onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant={editor.isActive("underline") ? "default" : "outline"} title="Podtržení"
        onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Button>
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={NB_FONT_SIZES.includes(currentSize as any) ? currentSize : ""}
        onChange={(e) => editor.chain().focus().setNotebookFontSize(Number(e.target.value)).run()}
        aria-label="Velikost písma označeného textu"
        title="Velikost písma"
      >
        {!NB_FONT_SIZES.includes(currentSize as any) && <option value="">{currentSize}</option>}
        {NB_FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="flex h-9 items-center gap-1 rounded-md border bg-background px-2" title="Barva textu">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <input type="color" value={/^#/.test(currentColor) ? currentColor : "#000000"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          aria-label="Barva označeného textu" className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
      </label>
      <label className={cn("flex h-9 items-center gap-1 rounded-md border bg-background px-2", editor.isActive("highlight") && "ring-2 ring-primary")} title="Podbarvení">
        <Highlighter className="h-4 w-4 text-muted-foreground" />
        <input type="color" value={/^#/.test(currentBg) ? currentBg : "#FEF08A"}
          onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
          aria-label="Podbarvení označeného textu" className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
      </label>
      <Button type="button" size="icon" variant="outline" title="Zrušit formátování výběru"
        onClick={() => editor.chain().focus().unsetAllMarks().run()}><Eraser className="h-4 w-4" /></Button>
      <div className="ml-auto flex gap-1.5">
        <Button type="button" size="icon" variant="outline" title="Odebrat text" onClick={onRemove}><X className="h-4 w-4" /></Button>
        <Button type="button" size="sm" onClick={onDone}><Check className="mr-1 h-4 w-4" />Hotovo</Button>
      </div>
    </div>
  );

  return (
    <>
      {toolbarTarget && createPortal(toolbar, toolbarTarget)}
      <div
        className="block w-full min-w-0 max-w-none break-words"
        style={{
          color: box.color,
          fontSize: sizeToCqw(box.fontSize),
          fontWeight: box.bold ? 700 : 400,
          fontStyle: box.italic ? "italic" : "normal",
          lineHeight: NB_LINE_HEIGHT,
          fontFamily: NB_FONT_FAMILY,
        }}
        onKeyDown={(e) => { if (e.key === "Escape") onDone(); e.stopPropagation(); }}
      >
        <EditorContent editor={editor} className="block w-full min-w-0 max-w-none" />
      </div>
    </>
  );
};

export default NotebookTextEditor;
