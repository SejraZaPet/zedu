import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { SearchField, SearchEmpty } from "@/components/ui/search-field";
import { matchesSearch, selectFound } from "@/lib/picker-search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { fetchMyPreviewStudentIds } from "@/lib/preview-students";
import type { AudienceMode } from "@/lib/assignment-recipients";

interface Props {
  classId: string | null;
  groupId: string | null;
  mode: AudienceMode;
  onModeChange: (m: AudienceMode) => void;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  disabledReason?: string | null;
}

/** „Pro koho“: celá třída/skupina nebo vybraní žáci. */
export default function AssignmentRecipientsPicker({ classId, groupId, mode, onModeChange, selected, onSelectedChange, disabledReason }: Props) {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ids: string[] = [];
      if (groupId) {
        const { data } = await supabase.from("subject_group_members").select("student_id").eq("group_id", groupId);
        ids = ((data ?? []) as any[]).map((m) => m.student_id);
      } else if (classId) {
        const { data } = await supabase.from("class_members").select("user_id").eq("class_id", classId);
        ids = ((data ?? []) as any[]).map((m) => m.user_id);
      }
      const preview = new Set(await fetchMyPreviewStudentIds());
      ids = ids.filter((id) => !preview.has(id));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids)
        : { data: [] as any[] };
      const list = ids.map((id) => {
        const p = ((profiles ?? []) as any[]).find((x) => x.id === id);
        return { id, name: p ? `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim() || "Žák" : "Žák" };
      }).sort((a, b) => a.name.localeCompare(b.name, "cs"));
      if (!cancelled) setStudents(list);
    })();
    return () => { cancelled = true; };
  }, [classId, groupId]);

  const filtered = useMemo(() => {
    return students.filter((s) => matchesSearch(query, s.name));
  }, [students, query]);
  const set = new Set(selected);
  const toggle = (id: string) => onSelectedChange(set.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <fieldset className="space-y-2 min-w-0">
      <legend className="text-sm font-medium">Pro koho</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {(["all", "selected"] as const).map((m) => (
          <Button key={m} type="button" role="radio" aria-checked={mode === m}
            variant={mode === m ? "default" : "outline"} className="min-h-11 whitespace-normal h-auto"
            disabled={m === "selected" && !!disabledReason}
            onClick={() => onModeChange(m)}>
            {m === "all" ? "Celá třída/skupina" : "Vybraní žáci"}
          </Button>
        ))}
      </div>
      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
      {mode === "selected" && !disabledReason && (
        <div className="space-y-2 rounded-md border p-2 min-w-0">
          <SearchField value={query} onChange={setQuery} label="Hledat žáka" count={filtered.length} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-11 h-auto whitespace-normal" onClick={() => onSelectedChange(selectFound(selected, filtered.map((s) => s.id)))}>Vybrat vše z nalezených</Button>
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onSelectedChange([])}>Nikdo</Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">Vybráno {selected.filter((id) => students.some((s) => s.id === id)).length} z {students.length}</span>
          </div>
          <ul className="max-h-64 overflow-y-auto overflow-x-hidden">
            {filtered.map((s) => (
              <li key={s.id}>
                <label className="flex min-h-11 items-center gap-3 rounded px-1 text-sm break-words hover:bg-muted">
                  <Checkbox checked={set.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <span className="min-w-0 break-words">{s.name}</span>
                </label>
              </li>
            ))}
            {filtered.length === 0 && <li><SearchEmpty onClear={() => setQuery("")} /></li>}
          </ul>
        </div>
      )}
    </fieldset>
  );
}
