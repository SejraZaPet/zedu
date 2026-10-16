import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SearchablePickList from "@/components/activities/SearchablePickList";
import { PLAN_KINDS, type PlanForm, type PlanKind, parsePlanTarget } from "@/lib/planned-assignment";
import { loadTextbookLessonOptions } from "@/lib/textbook-lesson-options";
import type { PlanLesson } from "@/lib/planned-assignment";

interface Props { form: PlanForm; onChange: (f: PlanForm) => void }

/** Pole dialogu „Přidat úkol“ pro volbu „Třídě nebo skupině“. */
export default function PlanForClassFields({ form, onChange }: Props) {
  const { myClasses } = useTeacherClasses();
  const { groups } = useSubjectGroups();
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [textbooks, setTextbooks] = useState<{ id: string; title: string }[]>([]);
  const [textbookId, setTextbookId] = useState("");
  const [lessonOptions, setLessonOptions] = useState<PlanLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const set = (patch: Partial<PlanForm>) => onChange({ ...form, ...patch });

  // Předměty podle cíle: skupina → její předměty, třída → předměty z rozvrhu třídy.
  useEffect(() => {
    const t = parsePlanTarget(form.target);
    if (!t) { setSubjects([]); return; }
    let cancelled = false;
    (async () => {
      let ids: string[] = [];
      if (t.group_id) {
        const g = groups.find((x) => x.id === t.group_id);
        ids = g ? (g.subjectIds?.length ? g.subjectIds : [g.subject_id]) : [];
      } else {
        const { data } = await supabase.from("class_schedule_slots").select("subject_id").eq("class_id", t.class_id!).is("group_id", null).not("subject_id", "is", null);
        ids = [...new Set(((data as any[]) ?? []).map((r) => r.subject_id))];
      }
      const { data: rows } = ids.length ? await supabase.from("subjects").select("id, name").in("id", ids) : { data: [] as any[] };
      if (cancelled) return;
      const list = ((rows as any[]) ?? []).map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name, "cs"));
      setSubjects(list);
      const keep = list.some((s) => s.id === form.subjectId);
      if (!keep) onChange({ ...form, subjectId: list.length === 1 ? list[0].id : null });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.target, groups]);

  useEffect(() => {
    supabase.from("teacher_textbooks" as any).select("id, title").order("title", { ascending: true })
      .then(({ data }) => setTextbooks(((data as any[]) ?? []).map((t) => ({ id: t.id, title: t.title }))));
  }, []);

  useEffect(() => {
    if (!textbookId) { setLessonOptions([]); return; }
    let cancelled = false;
    setLessonsLoading(true);
    loadTextbookLessonOptions(textbookId).then((opts) => { if (!cancelled) { setLessonOptions(opts); setLessonsLoading(false); } });
    return () => { cancelled = true; };
  }, [textbookId]);

  // Vybrané lekce mohou pocházet z různých učebnic – v seznamu je zobrazíme vždy.
  const pickItems = [...form.lessons.filter((l) => !lessonOptions.some((o) => o.id === l.id)), ...lessonOptions];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="plan-target">Třída nebo skupina *</Label>
        <Select value={form.target || undefined} onValueChange={(v) => set({ target: v })}>
          <SelectTrigger id="plan-target" className="mt-1"><SelectValue placeholder="Vyberte třídu nebo skupinu" /></SelectTrigger>
          <SelectContent>
            {myClasses.length > 0 && (
              <SelectGroup>
                <SelectLabel>Třídy</SelectLabel>
                {myClasses.map((c) => <SelectItem key={c.id} value={`class:${c.id}`}>{c.name}</SelectItem>)}
              </SelectGroup>
            )}
            {groups.length > 0 && (
              <SelectGroup>
                <SelectLabel>Skupiny</SelectLabel>
                {groups.map((g) => <SelectItem key={g.id} value={`group:${g.id}`}>{g.name}{g.subjectName ? ` · ${g.subjectName}` : ""}</SelectItem>)}
              </SelectGroup>
            )}
            {myClasses.length === 0 && groups.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Nemáte žádnou třídu ani skupinu.</div>}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="plan-subject">Předmět</Label>
          <Select value={form.subjectId ?? "__none__"} onValueChange={(v) => set({ subjectId: v === "__none__" ? null : v })} disabled={!form.target}>
            <SelectTrigger id="plan-subject" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Bez předmětu —</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="plan-kind">Typ *</Label>
          <Select value={form.kind} onValueChange={(v) => set({ kind: v as PlanKind })}>
            <SelectTrigger id="plan-kind" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{PLAN_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="plan-title">Název *</Label>
        <Input id="plan-title" className="mt-1" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Např. Test – zlomky" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="plan-date">Termín *</Label>
          <Input id="plan-date" type="date" className="mt-1" value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="plan-time">Čas</Label>
          <Input id="plan-time" type="time" className="mt-1" value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </div>
      </div>

      <div>
        <Label htmlFor="plan-note">Poznámka pro žáky</Label>
        <Textarea id="plan-note" className="mt-1" rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Např. Přineste si kalkulačku." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-textbook">Lekce, ze kterých se bude psát (volitelné)</Label>
        <Select value={textbookId || "__none__"} onValueChange={(v) => setTextbookId(v === "__none__" ? "" : v)}>
          <SelectTrigger id="plan-textbook"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Vyberte učebnici —</SelectItem>
            {textbooks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {lessonsLoading ? <p className="text-xs text-muted-foreground">Načítám lekce…</p> : pickItems.length > 0 && (
          <SearchablePickList items={pickItems} mode="multi" selected={form.lessons.map((l) => l.id)} showCount
            label="Lekce" searchPlaceholder="Hledat lekci" searchFrom={5}
            onChange={(ids) => set({ lessons: ids.map((id) => pickItems.find((p) => p.id === id)!).filter(Boolean) })} />
        )}
        <p className="text-xs text-muted-foreground">Obsah (digitální test nebo pracovní list) připojíte později v Úlohách přes Upravit → Uložit změny. Do té doby žáci uvidí jen termín a lekce.</p>
      </div>
    </div>
  );
}
