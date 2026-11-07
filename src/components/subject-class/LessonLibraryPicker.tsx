import { useEffect, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addContentMaterial,
  CONTENT_TYPE_LABEL,
  type LessonContentMaterial,
  type LessonContentType,
} from "@/lib/lesson-content-materials";
import { SearchField, SearchEmpty } from "@/components/ui/search-field";
import { matchesSearch } from "@/lib/picker-search";
import type { LessonSource } from "@/lib/linked-lesson";

interface Item { refId: string; title: string; contentType: LessonContentType; lessonSource?: LessonSource; extra?: string }

interface Props {
  teacherId: string;
  selected: LessonContentMaterial[];
  onChange: (next: LessonContentMaterial[]) => void;
}

const TYPES: LessonContentType[] = ["worksheet", "presentation", "lesson"];

/** Výběr z učitelovy knihovny (pracovní listy, prezentace, lekce vlastních učebnic). Jen čtení. Aktivity záměrně ne. */
export default function LessonLibraryPicker({ teacherId, selected, onChange }: Props) {
  const [type, setType] = useState<LessonContentType>("worksheet");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      
      let out: Item[] = [];
      try {
        if (type === "worksheet") {
          let qb = supabase.from("worksheets").select("id, title").eq("teacher_id", teacherId).order("updated_at", { ascending: false }).limit(1000);
          const { data } = await qb;
          out = ((data as any[]) ?? []).map((r) => ({ refId: r.id, title: r.title || "Pracovní list", contentType: "worksheet" }));
        } else if (type === "presentation") {
          let qb = supabase.from("teacher_presentations").select("id, title").eq("teacher_id", teacherId).order("updated_at", { ascending: false }).limit(1000);
          const { data } = await qb;
          out = ((data as any[]) ?? []).map((r) => ({ refId: r.id, title: r.title || "Prezentace", contentType: "presentation" }));
        } else {
          const { data: tbs } = await supabase.from("teacher_textbooks").select("id, title").eq("teacher_id", teacherId).is("deleted_at", null).limit(100);
          const tbList = (tbs as any[]) ?? [];
          const tbTitle = new Map(tbList.map((t) => [t.id, t.title]));
          if (tbList.length) {
            let qb = supabase.from("teacher_textbook_lessons" as any).select("id, title, textbook_id").in("textbook_id", tbList.map((t) => t.id)).order("updated_at", { ascending: false }).limit(1000);
              const { data } = await qb;
            out = ((data as any[]) ?? []).map((r) => ({ refId: r.id, title: r.title || "Lekce", contentType: "lesson", lessonSource: "teacher_textbook_lessons", extra: tbTitle.get(r.textbook_id) }));
          }
        }
      } catch {
        out = [];
      }
      if (!cancelled) { setItems(out); setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [type, teacherId]);

  const isSelected = (i: Item) => selected.some((m) => m.contentType === i.contentType && m.refId === i.refId);

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Druh materiálu">
        {TYPES.map((t) => (
          <Button key={t} type="button" size="sm" variant={type === t ? "secondary" : "ghost"} className="min-h-[44px] sm:min-h-0" aria-pressed={type === t} onClick={() => setType(t)}>
            {CONTENT_TYPE_LABEL[t]}
          </Button>
        ))}
      </div>
      <SearchField value={q} onChange={setQ} label="Hledat materiál" count={items.filter(i => matchesSearch(q, i.title, i.extra)).length} />
      <ul className="max-h-64 overflow-y-auto space-y-1 min-w-0" aria-busy={loading}>
        {!loading && items.filter(i => matchesSearch(q, i.title, i.extra)).length === 0 && <li><SearchEmpty onClear={() => setQ("")} /></li>}
        {items.filter(i => matchesSearch(q, i.title, i.extra)).map((i) => {
          const sel = isSelected(i);
          return (
            <li key={i.refId}>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start h-auto min-h-[44px] whitespace-normal text-left"
                disabled={sel}
                onClick={() => onChange(addContentMaterial(selected, { contentType: i.contentType, refId: i.refId, title: i.title, ...(i.lessonSource ? { lessonSource: i.lessonSource } : {}) }))}
              >
                {sel ? <Check className="h-4 w-4 mr-2 shrink-0" /> : <Plus className="h-4 w-4 mr-2 shrink-0" />}
                <span className="min-w-0 break-words">
                  {i.title}
                  {i.extra && <span className="block text-[11px] text-muted-foreground">{i.extra}</span>}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
