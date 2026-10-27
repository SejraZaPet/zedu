import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";
import { supabase } from "@/integrations/supabase/client";
import { excludePreviewStudents, fetchMyPreviewStudentIds } from "@/lib/preview-students";
import { classroomTargetSource, drawClassroomPerson, loadClassroomAbsent, parseClassroomNames, presentClassroomPeople, saveClassroomAbsent, splitClassroomGroups, type ClassroomPerson, type ClassroomTarget } from "@/lib/classroom-tools";

function PeopleSource({ onPeople, initialTarget }: { onPeople: (people: ClassroomPerson[]) => void; initialTarget?: ClassroomTarget }) {
  const { myClasses, loading: classesLoading, refetch: refetchClasses } = useTeacherClasses();
  const { groups, loading: groupsLoading, refetch: refetchGroups } = useSubjectGroups();
  const [source, setSource] = useState("manual");
  const [manual, setManual] = useState("");
  const [people, setPeople] = useState<ClassroomPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [absent, setAbsent] = useState<string[]>([]);
  const [fromPlan, setFromPlan] = useState(false);
  const [hideList, setHideList] = useState(false);
  const preselected = useRef(false);
  const userPicked = useRef(false);
  const listsLoading = classesLoading || groupsLoading;
  // Předvýběr i při pozdějším načtení seznamů, ale jen dokud učitel sám nic nevybral.
  useEffect(() => {
    if (preselected.current || userPicked.current || listsLoading) return;
    const next = classroomTargetSource(initialTarget, myClasses, groups);
    if (next === "manual") return;
    preselected.current = true;
    setSource(next);
    setFromPlan(true);
  }, [listsLoading, initialTarget, myClasses, groups]);
  const listsEmpty = !listsLoading && myClasses.length === 0 && groups.length === 0;
  const refreshLists = () => { void refetchClasses?.(); void refetchGroups?.(); };
  useEffect(() => { setAbsent(loadClassroomAbsent(source)); }, [source]);
  const pickSource = (v: string) => { userPicked.current = true; setFromPlan(false); setSource(v); };
  const updateAbsent = (next: string[]) => { setAbsent(next); saveClassroomAbsent(source, next); };
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
        const previewIds = await fetchMyPreviewStudentIds();
        const ids = excludePreviewStudents([...new Set((membership.data ?? []).map(row => "user_id" in row ? row.user_id : row.student_id))], (x) => x, previewIds);
        if (!ids.length) return;
        const { data, error: profileError } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
        if (profileError) throw profileError;
        if (active) setPeople((data ?? []).map(p => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Žák" })).sort((a, b) => a.name.localeCompare(b.name, "cs")));
      } catch { if (active) setError("Jména se nepodařilo načíst. Zkuste vybrat třídu znovu nebo vložte vlastní seznam."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [source, myClasses.map(c => c.id).join(","), groups.map(g => g.id).join(",")]);
  const present = useMemo(() => presentClassroomPeople(people, absent), [people, absent]);
  useEffect(() => { onPeople(source === "manual" ? manualPeople : present); }, [source, manualPeople, present, onPeople]);
  return <div className="space-y-3">
    <label className="block space-y-2"><span>Třída nebo skupina</span><Select value={source} onValueChange={pickSource} disabled={listsLoading}><SelectTrigger aria-label="Třída nebo skupina"><SelectValue placeholder="Načítám třídy…" />{listsLoading && <span className="sr-only">Načítám třídy…</span>}</SelectTrigger><SelectContent>{myClasses.length > 0 && <SelectGroup><SelectLabel>Třídy</SelectLabel>{myClasses.map(c => <SelectItem key={c.id} value={`class:${c.id}`}>{c.name}</SelectItem>)}</SelectGroup>}{groups.length > 0 && <SelectGroup><SelectLabel>Skupiny</SelectLabel>{groups.map(g => <SelectItem key={g.id} value={`group:${g.id}`}>{g.name}</SelectItem>)}</SelectGroup>}<SelectGroup><SelectLabel>Jiné</SelectLabel><SelectItem value="manual">Vlastní seznam</SelectItem></SelectGroup></SelectContent></Select></label>
    {listsLoading && <p className="text-sm text-muted-foreground">Načítám třídy a skupiny…</p>}
    {listsEmpty && <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>Nenalezeny žádné třídy ani skupiny – zkuste Obnovit.</span><Button type="button" size="sm" variant="outline" onClick={refreshLists}>Obnovit seznam tříd</Button></div>}
    {fromPlan && <p className="text-sm text-muted-foreground">Předvybráno z plánu hodiny.</p>}
    {source === "manual" && <label className="block space-y-2"><span>Jména — jedno na řádek</span><Textarea value={manual} onChange={e => setManual(e.target.value)} rows={4} aria-label="Jména — jedno na řádek" /></label>}
    {source !== "manual" && people.length > 0 && <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Kdo je dnes ve škole</span>
        <Button type="button" size="sm" variant="outline" onClick={() => updateAbsent([])}>Všichni přítomni</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => updateAbsent(people.map(p => p.id))}>Odznačit všechny</Button>
        <Button type="button" size="sm" variant="ghost" aria-expanded={!hideList} onClick={() => setHideList(v => !v)}>{hideList ? "Zobrazit seznam žáků" : "Skrýt seznam žáků"}</Button>
      </div>
      {!hideList && <ul className="flex flex-wrap gap-2" aria-label="Přítomnost žáků">{people.map(p => { const isAbsent = absent.includes(p.id); return <li key={p.id}><button type="button" aria-pressed={!isAbsent} aria-label={`${p.name}: ${isAbsent ? "nepřítomen" : "přítomen"}`} onClick={() => updateAbsent(isAbsent ? absent.filter(id => id !== p.id) : [...absent, p.id])} className={`rounded-full border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isAbsent ? "border-border bg-muted text-muted-foreground line-through" : "border-primary bg-primary/10 text-foreground"}`}>{p.name}</button></li>; })}</ul>}
    </div>}
    <p className="text-sm text-muted-foreground" role="status">{loading || listsLoading ? "Načítání…" : error || (source === "manual" ? `${manualPeople.length} žáků` : `Přítomno ${present.length} z ${people.length}`)}</p>
  </div>;
}

export function PeopleTool({ grouping = false, initialTarget }: { grouping?: boolean; initialTarget?: ClassroomTarget }) {
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
    <div className="mx-auto w-full max-w-xl"><PeopleSource onPeople={setPeople} initialTarget={initialTarget} /></div>
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
