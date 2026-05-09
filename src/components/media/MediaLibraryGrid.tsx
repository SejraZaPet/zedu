import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Music,
  Video,
  File as FileIcon,
  MoreVertical,
  Search,
  Copy,
  Download,
  Pencil,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  isImage,
  type TeacherMediaItem,
} from "@/lib/teacher-media";
import { useSignedUrls } from "@/hooks/useTeacherMedia";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface Props {
  items: TeacherMediaItem[];
  onSelect?: (item: TeacherMediaItem, signedUrl: string) => void;
  onRename?: (item: TeacherMediaItem) => void;
  onDelete?: (item: TeacherMediaItem) => void;
  onCopyUrl?: (item: TeacherMediaItem, signedUrl: string) => void;
  onDownload?: (item: TeacherMediaItem, signedUrl: string) => void;
  /** Restrict to images (used in pickers for image fields). */
  imageOnly?: boolean;
  /** Make tiles act as clickable selectors (for picker). */
  picker?: boolean;
}

function MimeIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime === "application/pdf") return <FileText className={className} />;
  if (mime.startsWith("audio/")) return <Music className={className} />;
  if (mime.startsWith("video/")) return <Video className={className} />;
  return <FileIcon className={className} />;
}

export function MediaLibraryGrid({
  items,
  onSelect,
  onRename,
  onDelete,
  onCopyUrl,
  onDownload,
  imageOnly = false,
  picker = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (imageOnly) list = list.filter((i) => isImage(i.mime_type));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.filename.toLowerCase().includes(q));
    }
    if (activeTag) list = list.filter((i) => i.tags.includes(activeTag));
    return list;
  }, [items, search, activeTag, imageOnly]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const paths = useMemo(() => filtered.map((f) => f.storage_path), [filtered]);
  const urls = useSignedUrls(paths);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat podle názvu…"
            className="pl-8"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setActiveTag(null)}
              className={cn(
                "text-xs px-2 py-1 rounded-md border",
                activeTag === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              Vše
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={cn(
                  "text-xs px-2 py-1 rounded-md border inline-flex items-center gap-1",
                  activeTag === tag
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                <FolderOpen className="w-3 h-3" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Žádné soubory
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((item) => {
            const url = urls[item.storage_path];
            const isImg = isImage(item.mime_type);
            const tile = (
              <div
                className={cn(
                  "group relative rounded-lg border border-border bg-card overflow-hidden",
                  picker && "cursor-pointer hover:ring-2 hover:ring-primary transition",
                )}
                onClick={
                  picker && url
                    ? () => onSelect?.(item, url)
                    : undefined
                }
              >
                <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                  {isImg && url ? (
                    <img
                      src={url}
                      alt={item.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MimeIcon mime={item.mime_type} className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2">
                  <div className="text-xs font-medium truncate" title={item.filename}>
                    {item.filename}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-between mt-0.5">
                    <span>{formatBytes(item.size_bytes)}</span>
                    <span>
                      {format(new Date(item.created_at), "d. M. yyyy", { locale: cs })}
                    </span>
                  </div>
                </div>

                {!picker && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Akce"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => url && onCopyUrl?.(item, url)}
                          disabled={!url}
                        >
                          <Copy className="w-4 h-4 mr-2" /> Kopírovat URL
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => url && onDownload?.(item, url)}
                          disabled={!url}
                        >
                          <Download className="w-4 h-4 mr-2" /> Stáhnout
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRename?.(item)}>
                          <Pencil className="w-4 h-4 mr-2" /> Přejmenovat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete?.(item)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Smazat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
            return <div key={item.id}>{tile}</div>;
          })}
        </div>
      )}
    </div>
  );
}
