import { useEffect, useMemo, useState } from "react";
import { Dices, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";
import { supabase } from "@/integrations/supabase/client";
import { drawClassroomPerson, parseClassroomNames, splitClassroomGroups, type ClassroomPerson } from "@/lib/classroom-tools";

function PeopleSource({ onPeople }: { onPeople: (people: ClassroomPerson[]) => void }) {
  const { myClasses, loading: classesLoading } = useTeacherClasses();
  const { groups, loading: groupsLoading } = useSubjectGroups();
  const [source, setSource] = useState("manual");
  const [manual, setManual] = useState("");
  const [people, setPeople] = useState<ClassroomPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const manualPeople = useMemo(() => parseClassroomNames(manual), [manual]);
  useEffect(() => {
    let active = true;
    setError(""); setPeople([]);
    if (source === "manual") { setLoading(false); return; }
    const [kind, id] = source.split(":");
    if (!id || (kind === "class" ? !myClasses.some(c => c.id === id) : !groups.some(g => g.id === id))) return;
    setLoading(true);
    void (async () => {
      try {
        const membership = kind === "class"
          ? await supabase.from("class_members").select("user_id").eq("class_id", id)
          : await supabase.from("subject_group_members").select("student_id").eq("group_id", id);
        if (membership.error) throw membership.error;
        const ids = [...new Set((membership.data ?? []).map(row => "user_id" in row ? row.user_id : row.student_id))];
        if (!ids.length) return;
        const { data, error: profileError } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
        if (profileError) throw profileError;
        if (active) setPeople((data ?? []).map(p => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Žák" })).sort((a, b) => a.name.localeCompare(b.name, "cs")));
      } catch { if (active) setError("Jména se nepodařilo načíst. Zkuste vybrat třídu znovu nebo vložte vlastní seznam."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [source, myClasses.map(c => c.id).join(","), groups.map(g => g.id).join(",")]);
  useEffect(() => { onPeople(source === "manual" ? manualPeople : people); }, [source, manualPeople, people, onPeople]);
  return <div className="space-y-3">
    <label className="block space-y-2"><span>Seznam žáků</span><Select value={source} onValueChange={setSource}><SelectTrigger aria-label="Seznam žáků"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Vlastní seznam</SelectItem>{myClasses.map(c => <SelectItem key={c.id} value={`class:${c.id}`}>Třída · {c.name}</SelectItem>)}{groups.map(g => <SelectItem key={g.id} value={`group:${g.id}`}>Skupina · {g.name}</SelectItem>)}</SelectContent></Select></label>
    {source === "manual" && <label className="block space-y-2"><span>Jména — jedno na řádek</span><Textarea value={manual} onChange={e => setManual(e.target.value)} rows={4} aria-label="Jména — jedno na řádek" /></label>}
    <p className="text-sm text-muted-foreground" role="status">{loading || classesLoading || groupsLoading ? "Načítání…" : error || `${source === "manual" ? manualPeople.length : people.length} žáků`}</p>
  </div>;
}

export function PeopleTool({ grouping = false }: { grouping?: boolean }) {
  const [people, setPeople] = useState<ClassroomPerson[]>([]);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [selected, setSelected] = useState<ClassroomPerson | null>(null);
  const [noRepeat, setNoRepeat] = useState(true);
  const [mode, setMode] = useState<"count" | "size">("count");
  const [value, setValue] = useState("3");
  const [result, setResult] = useState<ClassroomPerson[][]>([]);
  useEffect(() => { setDrawn([]); setSelected(null); setResult([]); }, [people]);
  const exhausted = noRepeat && people.length > 0 && drawn.length >= people.length;
  const valid = Number.isInteger(Number(value)) && Number(value) >= 1;
  return <div className="classroom-tool-body">
    <div className="mx-auto w-full max-w-xl"><PeopleSource onPeople={setPeople} /></div>
    {grouping ? <>
      <div className="flex flex-wrap items-end justify-center gap-3"><label className="space-y-2"><span>Rozdělit podle</span><Select value={mode} onValueChange={v => setMode(v as "count" | "size")}><SelectTrigger aria-label="Rozdělit podle"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="count">Počtu skupin</SelectItem><SelectItem value="size">Počtu lidí ve skupině</SelectItem></SelectContent></Select></label><label>{mode === "count" ? "Počet skupin" : "Lidí ve skupině"}<Input type="number" min={1} className="w-28" value={value} onChange={e => setValue(e.target.value)} /></label><Button size="lg" disabled={!people.length || !valid} onClick={() => setResult(splitClassroomGroups(people, mode, Number(value)))}><Shuffle />{result.length ? "Rozdělit znovu" : "Rozdělit"}</Button></div>
      <div className="classroom-groups" aria-live="polite">{result.map((g, i) => <section key={i} className="border-t-4 border-primary pt-4"><h3 className="text-xl">Skupina {i + 1}</h3><ul>{g.map(p => <li className="classroom-person" key={p.id}>{p.name}</li>)}</ul></section>)}</div>
    </> : <>
      <div className="classroom-drawn" aria-live="polite">{selected?.name ?? "—"}</div>
      <div className="flex flex-wrap justify-center gap-3"><Button size="lg" disabled={!people.length || exhausted} onClick={() => { const p = drawClassroomPerson(people, drawn, noRepeat); if (p) { setSelected(p); setDrawn(v => v.includes(p.id) ? v : [...v, p.id]); } }}><Dices />Vylosovat</Button><Button size="lg" variant="outline" onClick={() => { setDrawn([]); setSelected(null); }}><RotateCcw />Nové losování</Button></div>
      <label className="flex justify-center items-center gap-3"><Switch checked={noRepeat} onCheckedChange={setNoRepeat} />Nelosovat už vylosované</label>
      <p role="status" className="text-center">{exhausted ? "Všichni už byli vylosováni." : `${drawn.length} vylosováno`}</p>
    </>}
  </div>;
}
