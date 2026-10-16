import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ATTACHED_TYPE_LABEL, type AttachedItem, type AttachedItemType } from "@/lib/plan-attachments";

type Filter = "all" | AttachedItemType;

const FILTER_LABELS: Record<Filter, string> = {
  all: "Vše",
  worksheet: "Pracovní listy",
  game_template: "Hry a kvízy",
  presentation: "Prezentace",
  lesson: "Lekce",
  link: "Odkazy",
};

interface Option {
  key: string;
  item: AttachedItem;
}

interface Props {
  teacherId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alreadyAttached: AttachedItem[];
  onAttach: (items: AttachedItem[]) => void;
}

/** Výběr existující aktivity učitele (listy, hry, prezentace, lekce) k připnutí ke kroku plánu. */
export default function AttachExistingDialog({ teacherId, open, onOpenChange, alreadyAttached, onAttach }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !teacherId) return;
    setLoading(true);
    void (async () => {
      const [ws, games, pres, books] = await Promise.all([
        supabase.from("worksheets").select("id, title").eq("teacher_id", teacherId).order("created_at", { ascending: false }).limit(200),
        supabase.from("teacher_game_templates").select("id, title").eq("teacher_id", teacherId).order("created_at", { ascending: false }).limit(200),
        supabase.from("teacher_presentations").select("id, title").eq("teacher_id", teacherId).order("created_at", { ascending: false }).limit(200),
        supabase.from("teacher_textbooks").select("id, title").eq("teacher_id", teacherId).limit(100),
      ]);
      const out: Option[] = [];
      for (const w of (ws.data as any[]) ?? []) {
        out.push({ key: `w:${w.id}`, item: { type: "worksheet", id: w.id, title: w.title || "Pracovní list" } });
      }
      for (const g of (games.data as any[]) ?? []) {
        out.push({ key: `g:${g.id}`, item: { type: "game_template", id: g.id, title: g.title || "Hra" } });
      }
      for (const p of (pres.data as any[]) ?? []) {
        out.push({ key: `p:${p.id}`, item: { type: "presentation", id: p.id, title: p.title || "Prezentace" } });
      }
      const bookIds = (((books.data as any[]) ?? [])).map((b) => b.id);
      if (bookIds.length) {
        const { data: lessons } = await supabase
          .from("teacher_textbook_lessons" as any)
          .select("id, title, textbook_id")
          .in("textbook_id", bookIds)
          .order("created_at", { ascending: false })
          .limit(300);
        for (const l of (lessons as any[]) ?? []) {
          out.push({
            key: `l:${l.id}`,
            item: { type: "lesson", id: l.id, title: l.title || "Lekce", lessonSource: "teacher_textbook_lessons", textbookId: l.textbook_id },
          });
        }
      }
      setOptions(out);
      setLoading(false);
    })();
  }, [open, teacherId]);

  const attachedKeys = useMemo(
    () => new Set(alreadyAttached.map((a) => `${a.type}:${a.id ?? a.url}`)),
    [alreadyAttached],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => {
      if (filter !== "all" && o.item.type !== filter) return false;
      if (attachedKeys.has(`${o.item.type}:${o.item.id ?? o.item.url}`)) return false;
      return !q || o.item.title.toLowerCase().includes(q);
    });
  }, [options, filter, query, attachedKeys]);

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const confirm = () => {
    const items = options.filter((o) => picked.includes(o.key)).map((o) => o.item);
    onAttach(items);
    setPicked([]);
    setQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vybrat existující aktivitu</DialogTitle>
          <DialogDescription>Vyberte ze svých pracovních listů, her, prezentací a lekcí.</DialogDescription>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat podle názvu…" aria-label="Hledat aktivitu" />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABELS) as Filter[]).filter((f) => f !== "link").map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
            </Button>
          ))}
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && <p className="p-2 text-sm text-muted-foreground">Načítání…</p>}
          {!loading && visible.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">Žádná aktivita nenalezena.</p>
          )}
          {visible.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
              <Checkbox checked={picked.includes(o.key)} onCheckedChange={() => toggle(o.key)} />
              <span className="flex-1 truncate">{o.item.title}</span>
              <span className="text-xs text-muted-foreground">{ATTACHED_TYPE_LABEL[o.item.type]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button disabled={picked.length === 0} onClick={confirm}>Připnout ({picked.length})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
