import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading2, Heading3, Quote, LinkIcon, ImageIcon, Upload,
  AlignLeft, AlignCenter
} from "lucide-react";
import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

const MenuButton = ({
  active, onClick, children, title,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const RichTextEditor = ({ content, onChange }: Props) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imgOpen, setImgOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [imgCaption, setImgCaption] = useState("");
  const [imgWidth, setImgWidth] = useState("100%");
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image.configure({ HTMLAttributes: { class: "rounded" } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
      Placeholder.configure({ placeholder: "Začněte psát článek…" }),
    ],
    content,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[200px] p-3 focus:outline-none " +
          "[&_h2]:font-heading [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-xl " +
          "[&_h3]:font-heading [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-lg " +
          "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic " +
          "[&_img]:mx-auto [&_img]:my-4 [&_img]:rounded",
      },
    },
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setImgUrl(data.publicUrl);
    }
    setUploading(false);
  }, [editor]);

  const insertLink = () => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    setLinkUrl("");
    setLinkOpen(false);
  };

  const insertImage = () => {
    if (!editor || !imgUrl) return;
    // Build an image with optional caption via a figure pattern
    const style = `max-width:${imgWidth};margin:1rem auto;display:block;`;
    if (imgCaption) {
      editor.chain().focus().insertContent(
        `<figure style="text-align:center;${style}"><img src="${imgUrl}" alt="${imgCaption}" style="width:100%;border-radius:0.5rem;" /><figcaption style="font-size:0.85rem;color:#999;margin-top:0.25rem;">${imgCaption}</figcaption></figure>`
      ).run();
    } else {
      editor.chain().focus().setImage({ src: imgUrl }).updateAttributes("image", { style }).run();
    }
    setImgUrl("");
    setImgCaption("");
    setImgWidth("100%");
    setImgOpen(false);
  };

  if (!editor) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-border bg-muted/30">
        <MenuButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Tučné">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Kurzíva">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Podtržení">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Nadpis H2">
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Nadpis H3">
          <Heading3 className="w-4 h-4" />
        </MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Odrážky">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Číslování">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citace">
          <Quote className="w-4 h-4" />
        </MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton onClick={() => { setLinkUrl(editor.getAttributes("link").href || ""); setLinkOpen(true); }} title="Odkaz" active={editor.isActive("link")}>
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => setImgOpen(true)} title="Obrázek">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Zarovnat vlevo">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Zarovnat na střed">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
      </div>

      <EditorContent editor={editor} />

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vložit odkaz</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Odebrat</Button>
            <Button size="sm" onClick={insertLink}>Vložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image dialog */}
      <Dialog open={imgOpen} onOpenChange={setImgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vložit obrázek</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">URL obrázku</Label>
                <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…" className="mt-1" />
              </div>
              <Button size="sm" variant="outline" className="relative" disabled={uploading}>
                <Upload className="w-4 h-4 mr-1" />{uploading ? "…" : "Nahrát"}
                <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              </Button>
            </div>
            {imgUrl && <img src={imgUrl} alt="" className="max-h-32 rounded border border-border object-cover" />}
            <div>
              <Label className="text-xs">Popisek</Label>
              <Input value={imgCaption} onChange={(e) => setImgCaption(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Šířka</Label>
              <Select value={imgWidth} onValueChange={setImgWidth}>
                <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100%">100 %</SelectItem>
                  <SelectItem value="75%">75 %</SelectItem>
                  <SelectItem value="50%">50 %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={insertImage} disabled={!imgUrl}>Vložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RichTextEditor;
