import { useEffect, useRef } from "react";
import { Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotebookPageThumb from "@/components/notebook/NotebookPageThumb";
import { NotebookPage } from "@/lib/notebook";
import { pageDisplayTitle } from "@/lib/notebook-toc";
import { cn } from "@/lib/utils";

interface Props {
  pages: NotebookPage[];
  activeIndex: number;
  busy?: boolean;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (page: NotebookPage) => void;
  onDelete: (page: NotebookPage) => void;
}

/** Tablet/narrow layout: horizontal strip of small page thumbnails above the editor. */
export default function NotebookPageStrip({ pages, activeIndex, busy, onSelect, onAdd, onDuplicate, onDelete }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeIndex, pages.length]);

  return (
    <nav aria-label="Stránky sešitu" data-testid="nb-page-strip" className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex items-start gap-2 px-1">
        {pages.map((p, i) => {
          const active = i === activeIndex;
          const title = pageDisplayTitle(p, i);
          return (
            <li key={p.id} className="shrink-0">
              <div
                ref={active ? activeRef : undefined}
                data-active={active || undefined}
                className={cn(
                  "w-[104px] rounded-lg border-2 p-1 transition-colors",
                  active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => onSelect(i)}
                  aria-current={active ? "page" : undefined}
                  aria-label={`Stránka ${i + 1}: ${title}`}
                >
                  <NotebookPageThumb content={p.content} backgroundStyle={p.background_style} />
                </button>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium" title={title}>{i + 1}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Možnosti stránky ${i + 1}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onDuplicate(p)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplikovat stránku
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDelete(p)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Smazat stránku
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          );
        })}
        <li className="shrink-0 self-center">
          <Button size="icon" variant="outline" className="h-11 w-11" title="Přidat stránku" aria-label="Přidat stránku" disabled={busy} onClick={onAdd}>
            <Plus className="h-5 w-5" />
          </Button>
        </li>
      </ol>
    </nav>
  );
}
