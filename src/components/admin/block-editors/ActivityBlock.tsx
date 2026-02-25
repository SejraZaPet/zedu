import { Block } from "@/lib/textbook-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const ACTIVITY_TYPES = [
  { value: "flashcards", label: "Otáčecí kartičky" },
  { value: "quiz", label: "Kvíz" },
  { value: "matching", label: "Přiřazování A–B" },
  { value: "sorting", label: "Třídění do skupin" },
  { value: "image_label", label: "Popis obrázku (slepá mapa)" },
  { value: "fill_blanks", label: "Doplň slova" },
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

const ImageLabelEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const il = props.imageLabel || { imageUrl: "", markers: [], tolerance: 5, shuffleWords: true };
  const imgRef = React.useRef<HTMLDivElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `image-label/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (error) return;
    const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
    onChange({ ...props, imageLabel: { ...il, imageUrl: data.publicUrl } });
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const markers = [...il.markers, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, label: "" }];
    onChange({ ...props, imageLabel: { ...il, markers } });
  };

  const updateMarker = (idx: number, field: string, val: any) => {
    const markers = il.markers.map((m: any, i: number) => (i === idx ? { ...m, [field]: val } : m));
    onChange({ ...props, imageLabel: { ...il, markers } });
  };

  const removeMarker = (idx: number) => {
    onChange({ ...props, imageLabel: { ...il, markers: il.markers.filter((_: any, i: number) => i !== idx) } });
  };

  return (
    <div className="space-y-3">
      {/* Image upload */}
      {!il.imageUrl ? (
        <label className="flex items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nahrát obrázek</span>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Kliknutím na obrázek přidáte bod:</p>
          <div ref={imgRef} className="relative cursor-crosshair inline-block w-full" onClick={handleImageClick}>
            <img src={il.imageUrl} alt="" className="w-full rounded-lg" draggable={false} />
            {il.markers.map((m: any, i: number) => (
              <div
                key={i}
                className="absolute w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold transform -translate-x-1/2 -translate-y-1/2 border-2 border-background"
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...props, imageLabel: { ...il, imageUrl: "" } })}>
            Změnit obrázek
          </Button>
        </div>
      )}

      {/* Markers list */}
      {il.markers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Body a popisky</Label>
          {il.markers.map((m: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </span>
              <Input
                className="flex-1"
                placeholder={`Popisek bodu ${i + 1}`}
                value={m.label}
                onChange={(e) => updateMarker(i, "label", e.target.value)}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeMarker(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      <div className="flex flex-col gap-3 pt-2 border-t border-border">
        <div>
          <Label className="text-xs">Tolerance umístění: {il.tolerance}%</Label>
          <Slider
            min={2}
            max={15}
            step={1}
            value={[il.tolerance]}
            onValueChange={([v]) => onChange({ ...props, imageLabel: { ...il, tolerance: v } })}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={il.shuffleWords !== false}
            onCheckedChange={(v) => onChange({ ...props, imageLabel: { ...il, shuffleWords: !!v } })}
          />
          <Label className="text-xs">Zamíchat pořadí slov</Label>
        </div>
      </div>
    </div>
  );
};

import React from "react";

const FillBlanksEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const fb = props.fillBlanks || { text: "", caseSensitive: false, diacriticSensitive: true };
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Text aktivity</Label>
        <p className="text-xs text-muted-foreground mb-1">
          Slova k doplnění označte pomocí {"{{slovo}}"} — alternativní odpovědi oddělte lomítkem: {"{{křehké/krehke}}"}
        </p>
        <Textarea
          value={fb.text}
          onChange={(e) => onChange({ ...props, fillBlanks: { ...fb, text: e.target.value } })}
          placeholder="Hlavní město České republiky je {{Praha}}. Nejdelší řeka je {{Vltava/vltava}}."
          rows={5}
        />
      </div>
      {/* Preview extracted blanks */}
      {fb.text && (() => {
        const matches = [...fb.text.matchAll(/\{\{([^}]+)\}\}/g)];
        if (!matches.length) return null;
        return (
          <div className="text-xs text-muted-foreground space-y-1">
            <Label className="text-xs">Nalezené mezery ({matches.length}):</Label>
            <div className="flex flex-wrap gap-1.5">
              {matches.map((m: RegExpMatchArray, i: number) => (
                <span key={i} className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                  {m[1]}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="flex flex-col gap-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={fb.caseSensitive === true}
            onCheckedChange={(v) => onChange({ ...props, fillBlanks: { ...fb, caseSensitive: !!v } })}
          />
          <Label className="text-xs">Rozlišovat velká/malá písmena</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={fb.diacriticSensitive !== false}
            onCheckedChange={(v) => onChange({ ...props, fillBlanks: { ...fb, diacriticSensitive: !!v } })}
          />
          <Label className="text-xs">Rozlišovat diakritiku</Label>
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
        <div className="w-56">
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
      <div>
        <Label className="text-xs">Instrukce pro studenta</Label>
        <Textarea
          value={p.instructions || ""}
          onChange={(e) => onChange({ ...p, instructions: e.target.value })}
          placeholder="Např. Přečti si otázku a otoč kartičku pro zobrazení odpovědi…"
          rows={2}
        />
      </div>

      {activityType === "flashcards" && <FlashcardsEditor props={p} onChange={onChange} />}
      {activityType === "quiz" && <QuizEditor props={p} onChange={onChange} />}
      {activityType === "matching" && <MatchingEditor props={p} onChange={onChange} />}
      {activityType === "sorting" && <SortingEditor props={p} onChange={onChange} />}
      {activityType === "image_label" && <ImageLabelEditor props={p} onChange={onChange} />}
      {activityType === "fill_blanks" && <FillBlanksEditor props={p} onChange={onChange} />}
    </div>
  );
};

export default ActivityBlock;
