import { Block } from "@/lib/textbook-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ACTIVITY_TYPES = [
  { value: "flashcards", label: "Otáčecí kartičky" },
  { value: "quiz", label: "Kvíz" },
  { value: "matching", label: "Přiřazování A–B" },
  { value: "sorting", label: "Třídění do skupin" },
];

const FlashcardsEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const cards = props.flashcards || [{ front: "", back: "" }];
  const update = (idx: number, field: string, val: string) => {
    const next = cards.map((c: any, i: number) => i === idx ? { ...c, [field]: val } : c);
    onChange({ ...props, flashcards: next });
  };
  return (
    <div className="space-y-3">
      {cards.map((card: any, i: number) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Kartička {i + 1}</span>
            {cards.length > 1 && (
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onChange({ ...props, flashcards: cards.filter((_: any, j: number) => j !== i) })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Input placeholder="Přední strana" value={card.front} onChange={(e) => update(i, "front", e.target.value)} />
          <Input placeholder="Zadní strana" value={card.back} onChange={(e) => update(i, "back", e.target.value)} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...props, flashcards: [...cards, { front: "", back: "" }] })}>
        <Plus className="w-3 h-3 mr-1" />Přidat kartičku
      </Button>
    </div>
  );
};

const QuizEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const quiz = props.quiz || { question: "", answers: [{ text: "", correct: false }], explanation: "" };
  const updateAnswer = (idx: number, field: string, val: any) => {
    const answers = quiz.answers.map((a: any, i: number) => i === idx ? { ...a, [field]: val } : a);
    onChange({ ...props, quiz: { ...quiz, answers } });
  };
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Otázka</Label>
        <Input value={quiz.question} onChange={(e) => onChange({ ...props, quiz: { ...quiz, question: e.target.value } })} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Odpovědi</Label>
        {quiz.answers.map((a: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <Checkbox checked={a.correct} onCheckedChange={(v) => updateAnswer(i, "correct", !!v)} />
            <Input className="flex-1" placeholder={`Odpověď ${i + 1}`} value={a.text} onChange={(e) => updateAnswer(i, "text", e.target.value)} />
            {quiz.answers.length > 1 && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...props, quiz: { ...quiz, answers: quiz.answers.filter((_: any, j: number) => j !== i) } })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange({ ...props, quiz: { ...quiz, answers: [...quiz.answers, { text: "", correct: false }] } })}>
          <Plus className="w-3 h-3 mr-1" />Přidat odpověď
        </Button>
      </div>
      <div>
        <Label className="text-xs">Vysvětlení (volitelné)</Label>
        <Textarea value={quiz.explanation} onChange={(e) => onChange({ ...props, quiz: { ...quiz, explanation: e.target.value } })} rows={2} />
      </div>
    </div>
  );
};

const MatchingEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const matching = props.matching || { left: [""], right: [""], pairs: [[0, 0]] };
  const updateSide = (side: "left" | "right", idx: number, val: string) => {
    const arr = [...matching[side]];
    arr[idx] = val;
    onChange({ ...props, matching: { ...matching, [side]: arr } });
  };
  const addPair = () => {
    const left = [...matching.left, ""];
    const right = [...matching.right, ""];
    const pairs = [...matching.pairs, [left.length - 1, right.length - 1]];
    onChange({ ...props, matching: { left, right, pairs } });
  };
  const removePair = (idx: number) => {
    const left = matching.left.filter((_: any, j: number) => j !== idx);
    const right = matching.right.filter((_: any, j: number) => j !== idx);
    const pairs = matching.pairs.filter((_: any, j: number) => j !== idx).map((p: number[]) => [
      Math.min(p[0], left.length - 1),
      Math.min(p[1], right.length - 1),
    ]);
    onChange({ ...props, matching: { left, right, pairs: pairs.length ? pairs : [[0, 0]] } });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Položky na stejném řádku tvoří správný pár.</p>
      {matching.left.map((_: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder={`Levá ${i + 1}`} value={matching.left[i]} onChange={(e) => updateSide("left", i, e.target.value)} className="flex-1" />
          <span className="text-muted-foreground text-xs">↔</span>
          <Input placeholder={`Pravá ${i + 1}`} value={matching.right[i] || ""} onChange={(e) => updateSide("right", i, e.target.value)} className="flex-1" />
          {matching.left.length > 1 && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePair(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addPair}>
        <Plus className="w-3 h-3 mr-1" />Přidat pár
      </Button>
    </div>
  );
};

const SortingEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const sorting = props.sorting || { groups: ["Skupina 1", "Skupina 2"], items: [{ text: "", group: 0 }] };
  const updateGroup = (idx: number, val: string) => {
    const groups = sorting.groups.map((g: string, i: number) => i === idx ? val : g);
    onChange({ ...props, sorting: { ...sorting, groups } });
  };
  const updateItem = (idx: number, field: string, val: any) => {
    const items = sorting.items.map((it: any, i: number) => i === idx ? { ...it, [field]: val } : it);
    onChange({ ...props, sorting: { ...sorting, items } });
  };
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Skupiny</Label>
        <div className="space-y-1">
          {sorting.groups.map((g: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={g} onChange={(e) => updateGroup(i, e.target.value)} placeholder={`Skupina ${i + 1}`} />
              {sorting.groups.length > 2 && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                  const groups = sorting.groups.filter((_: any, j: number) => j !== i);
                  const items = sorting.items.map((it: any) => ({ ...it, group: Math.min(it.group, groups.length - 1) }));
                  onChange({ ...props, sorting: { groups, items } });
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
          {sorting.groups.length < 5 && (
            <Button variant="outline" size="sm" onClick={() => onChange({ ...props, sorting: { ...sorting, groups: [...sorting.groups, `Skupina ${sorting.groups.length + 1}`] } })}>
              <Plus className="w-3 h-3 mr-1" />Přidat skupinu
            </Button>
          )}
        </div>
      </div>
      <div>
        <Label className="text-xs">Položky k třídění</Label>
        <div className="space-y-1">
          {sorting.items.map((it: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="flex-1" value={it.text} onChange={(e) => updateItem(i, "text", e.target.value)} placeholder="Text položky" />
              <Select value={String(it.group)} onValueChange={(v) => updateItem(i, "group", Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorting.groups.map((g: string, gi: number) => (
                    <SelectItem key={gi} value={String(gi)}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sorting.items.length > 1 && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...props, sorting: { ...sorting, items: sorting.items.filter((_: any, j: number) => j !== i) } })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => onChange({ ...props, sorting: { ...sorting, items: [...sorting.items, { text: "", group: 0 }] } })}>
            <Plus className="w-3 h-3 mr-1" />Přidat položku
          </Button>
        </div>
      </div>
    </div>
  );
};

const ActivityBlock = ({ block, onChange }: Props) => {
  const p = block.props;
  const activityType = p.activityType || "flashcards";

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-xs">Název aktivity</Label>
          <Input value={p.title || ""} onChange={(e) => onChange({ ...p, title: e.target.value })} />
        </div>
        <div className="w-48">
          <Label className="text-xs">Typ aktivity</Label>
          <Select value={activityType} onValueChange={(v) => onChange({ ...p, activityType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activityType === "flashcards" && <FlashcardsEditor props={p} onChange={onChange} />}
      {activityType === "quiz" && <QuizEditor props={p} onChange={onChange} />}
      {activityType === "matching" && <MatchingEditor props={p} onChange={onChange} />}
      {activityType === "sorting" && <SortingEditor props={p} onChange={onChange} />}
    </div>
  );
};

export default ActivityBlock;
