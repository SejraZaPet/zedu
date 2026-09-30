import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Bold, Italic, Palette, Underline as UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignmentDescriptionToEditorHtml } from "@/lib/assignment-description";
import { COLOR_GROUPS } from "@/lib/color-palette";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

const TEXT_COLORS = [
  COLOR_GROUPS[0].colors[0],
  COLOR_GROUPS[1].colors[0],
  COLOR_GROUPS[1].colors[3],
  COLOR_GROUPS[1].colors[4],
  COLOR_GROUPS[1].colors[5],
];

const AssignmentDescriptionEditor = ({ content, onChange }: Props) => {
  const syncing = useRef(false);
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color],
    content: assignmentDescriptionToEditorHtml(content),
    onUpdate: ({ editor: currentEditor }) => {
      if (!syncing.current) onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-20 px-3 py-2 text-sm leading-relaxed focus:outline-none [&_p]:mb-2 [&_p:last-child]:mb-0",
        "aria-label": "Popis a instrukce úkolu",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = assignmentDescriptionToEditorHtml(content);
    if (next === editor.getHTML()) return;
    syncing.current = true;
    editor.commands.setContent(next, { emitUpdate: false });
    syncing.current = false;
  }, [content, editor]);

  if (!editor) return null;

  const formatButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", active && "bg-primary/15 text-primary")}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/30 px-1 py-1">
        {formatButton("Tučně", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />)}
        {formatButton("Kurzíva", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic className="h-4 w-4" />)}
        {formatButton("Podtržení", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="h-4 w-4" />)}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Barva textu" title="Barva textu">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="flex items-center gap-1" aria-label="Barvy textu">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => editor.chain().focus().unsetColor().run()}
              >
                Výchozí
              </Button>
              {TEXT_COLORS.map((color) => (
                <Button
                  key={color.value}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 p-1"
                  aria-label={color.name}
                  title={color.name}
                  onClick={() => editor.chain().focus().setColor(color.value).run()}
                >
                  <span className="h-full w-full rounded-sm border border-border" style={{ backgroundColor: color.value }} />
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default AssignmentDescriptionEditor;