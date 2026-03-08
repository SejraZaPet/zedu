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
  { value: "true_false", label: "Pravda / Nepravda" },
  { value: "matching", label: "Přiřazování A–B" },
  { value: "sorting", label: "Třídění do skupin" },
  { value: "ordering", label: "Seřaď pořadí" },
  { value: "reveal_cards", label: "Otevři kartičku" },
  { value: "memory_game", label: "Pexeso" },
  { value: "image_label", label: "Popis obrázku (slepá mapa)" },
  { value: "image_hotspot", label: "Klikni na správnou část" },
  { value: "fill_blanks", label: "Doplň slova" },
  { value: "fill_choice", label: "Doplň z nabídky" },
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

import React, { useState, useCallback, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type FillBlankToken =
  | { type: "text"; value: string }
  | { type: "blank"; answer: string; alternatives: string[] };

/** Convert legacy {{...}} text format to tokens */
export const legacyTextToTokens = (text: string): FillBlankToken[] => {
  const tokens: FillBlankToken[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: "text", value: text.slice(last, match.index) });
    const parts = match[1].split("/").map((s) => s.trim());
    tokens.push({ type: "blank", answer: parts[0], alternatives: parts.slice(1) });
    last = regex.lastIndex;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
};

/** Tokenize plain text into word-level tokens (split by whitespace, preserving spaces) */
const textToWordTokens = (text: string): FillBlankToken[] => {
  if (!text) return [];
  const tokens: FillBlankToken[] = [];
  // Split keeping whitespace as separate tokens
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (part) tokens.push({ type: "text", value: part });
  }
  return tokens;
};

/** Merge adjacent text tokens */
const mergeTextTokens = (tokens: FillBlankToken[]): FillBlankToken[] => {
  const result: FillBlankToken[] = [];
  for (const t of tokens) {
    const prev = result[result.length - 1];
    if (t.type === "text" && prev?.type === "text") {
      prev.value += t.value;
    } else {
      result.push({ ...t });
    }
  }
  return result;
};

const FillBlanksEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const fb = props.fillBlanks || { text: "", tokens: [], caseSensitive: false, diacriticSensitive: true };

  // Migrate legacy format on first render
  const getTokens = useCallback((): FillBlankToken[] => {
    if (fb.tokens && fb.tokens.length > 0) return fb.tokens;
    if (fb.text) return legacyTextToTokens(fb.text);
    return [];
  }, [fb.tokens, fb.text]);

  const tokens = getTokens();
  const [editingText, setEditingText] = useState(false);
  const [rawText, setRawText] = useState("");
  const [altPopover, setAltPopover] = useState<number | null>(null);

  const updateTokens = (newTokens: FillBlankToken[]) => {
    const merged = mergeTextTokens(newTokens);
    // Also keep a plain text representation for backward compat
    const plainText = merged.map(t => t.type === "text" ? t.value : `{{${t.answer}${t.alternatives.length ? "/" + t.alternatives.join("/") : ""}}}`).join("");
    onChange({ ...props, fillBlanks: { ...fb, tokens: merged, text: plainText } });
  };

  const handleStartEdit = () => {
    // Flatten tokens to plain text for editing
    const plain = tokens.map(t => t.type === "text" ? t.value : t.answer).join("");
    setRawText(plain);
    setEditingText(true);
  };

  const handleFinishEdit = () => {
    // Convert raw text to word-level tokens, preserving existing blanks by matching words
    const oldBlanks = new Map<string, string[]>();
    for (const t of tokens) {
      if (t.type === "blank") oldBlanks.set(t.answer.toLowerCase(), t.alternatives);
    }
    const newTokens = textToWordTokens(rawText);
    // Restore blank status for words that were previously blanks
    const restored: FillBlankToken[] = newTokens.map(t => {
      if (t.type === "text" && !t.value.match(/^\s+$/) && oldBlanks.has(t.value.toLowerCase())) {
        return { type: "blank" as const, answer: t.value, alternatives: oldBlanks.get(t.value.toLowerCase()) || [] };
      }
      return t;
    });
    updateTokens(restored);
    setEditingText(false);
  };

  const toggleBlank = (tokenIndex: number) => {
    const t = tokens[tokenIndex];
    if (!t) return;
    const newTokens = [...tokens];
    if (t.type === "text") {
      // Split the text token by words, find clicked word context
      // For simplicity, if it's just whitespace, ignore
      if (t.value.match(/^\s+$/)) return;
      // Toggle entire text token to blank
      newTokens[tokenIndex] = { type: "blank", answer: t.value, alternatives: [] };
    } else {
      // Unmark: convert blank back to text
      newTokens[tokenIndex] = { type: "text", value: t.answer };
    }
    updateTokens(newTokens);
  };

  const updateAlternatives = (tokenIndex: number, alts: string[]) => {
    const newTokens = [...tokens];
    const t = newTokens[tokenIndex];
    if (t.type === "blank") {
      newTokens[tokenIndex] = { ...t, alternatives: alts };
      updateTokens(newTokens);
    }
  };

  const blanksCount = tokens.filter(t => t.type === "blank").length;

  // Build word-level display tokens for clicking
  const displayTokens: { token: FillBlankToken; globalIdx: number; word: string; isWord: boolean }[] = [];
  tokens.forEach((t, gi) => {
    if (t.type === "blank") {
      displayTokens.push({ token: t, globalIdx: gi, word: t.answer, isWord: true });
    } else {
      // Split text into words and spaces for granular display
      const parts = t.value.split(/(\s+)/);
      for (const part of parts) {
        displayTokens.push({ token: t, globalIdx: gi, word: part, isWord: !part.match(/^\s*$/) });
      }
    }
  });

  // For word-level clicking in text tokens, we need to split text tokens into individual word tokens
  const handleWordClick = (globalIdx: number, word: string) => {
    const t = tokens[globalIdx];
    if (t.type === "blank") {
      // Unmark
      toggleBlank(globalIdx);
      return;
    }
    // Split this text token into parts, marking the clicked word as blank
    if (t.value.match(/^\s+$/)) return;
    const parts = t.value.split(/(\s+)/);
    if (parts.length <= 1) {
      // Single word, just toggle
      toggleBlank(globalIdx);
      return;
    }
    // Find the exact occurrence of the clicked word
    const newTokens: FillBlankToken[] = [];
    for (let i = 0; i < globalIdx; i++) newTokens.push(tokens[i]);
    for (const part of parts) {
      if (part === word && !newTokens.some((nt, ni) => ni >= globalIdx && nt.type === "blank" && nt.answer === word)) {
        // Check if this specific part is the one clicked (first unmatched occurrence)
        let alreadyMarked = false;
        for (const nt of newTokens) {
          if (nt.type === "blank" && nt.answer === word) { alreadyMarked = true; break; }
        }
        if (!alreadyMarked && part === word) {
          newTokens.push({ type: "blank", answer: part, alternatives: [] });
          // Push remaining parts
          const remaining = parts.slice(parts.indexOf(part) + 1).join("");
          if (remaining) newTokens.push({ type: "text", value: remaining });
          // Prepend earlier parts
          const idx = newTokens.length;
          for (let i = globalIdx + 1; i < tokens.length; i++) newTokens.push(tokens[i]);
          updateTokens(newTokens);
          return;
        }
      }
      newTokens.push({ type: "text", value: part });
    }
    for (let i = globalIdx + 1; i < tokens.length; i++) newTokens.push(tokens[i]);
    updateTokens(newTokens);
  };

  return (
    <div className="space-y-3">
      {/* Text editing mode */}
      {editingText ? (
        <div>
          <Label className="text-xs">Text aktivity</Label>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Napište text aktivity..."
            rows={5}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleFinishEdit}>Hotovo</Button>
            <Button size="sm" variant="outline" onClick={() => setEditingText(false)}>Zrušit</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Text aktivity</Label>
            <Button size="sm" variant="outline" onClick={handleStartEdit} className="h-6 text-xs px-2">
              {tokens.length === 0 ? "Napsat text" : "Upravit text"}
            </Button>
          </div>
          {tokens.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Zatím žádný text. Klikněte na „Napsat text".</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">Klikněte na slovo pro označení/odznačení jako mezera k doplnění:</p>
              <div className="bg-muted/30 border border-border rounded-lg p-3 leading-loose text-sm flex flex-wrap items-baseline gap-y-1">
                {(() => {
                  // Render word-level clickable tokens
                  const elements: React.ReactNode[] = [];
                  let keyIdx = 0;
                  tokens.forEach((t, gi) => {
                    if (t.type === "blank") {
                      const bi = gi;
                      elements.push(
                        <Popover key={keyIdx++} open={altPopover === gi} onOpenChange={(open) => setAltPopover(open ? gi : null)}>
                          <PopoverTrigger asChild>
                            <span
                              className="bg-primary/20 text-primary border border-primary/40 rounded px-1.5 py-0.5 cursor-pointer hover:bg-primary/30 transition-colors font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Right-click or alt-click for alternatives
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setAltPopover(gi);
                              }}
                            >
                              {t.answer}
                              <button
                                className="ml-1 text-muted-foreground hover:text-destructive text-xs"
                                onClick={(e) => { e.stopPropagation(); toggleBlank(gi); }}
                                title="Odznačit"
                              >✕</button>
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3 space-y-2" align="start">
                            <Label className="text-xs font-medium">Alternativní odpovědi pro „{t.answer}"</Label>
                            <p className="text-xs text-muted-foreground">Každá na nový řádek:</p>
                            <Textarea
                              value={t.alternatives.join("\n")}
                              onChange={(e) => updateAlternatives(gi, e.target.value.split("\n").filter(Boolean))}
                              rows={3}
                              placeholder="krehke&#10;krehké"
                              className="text-xs"
                            />
                            <div className="flex justify-between">
                              <Button size="sm" variant="ghost" className="text-destructive text-xs h-6" onClick={() => toggleBlank(gi)}>
                                Odznačit slovo
                              </Button>
                              <Button size="sm" className="text-xs h-6" onClick={() => setAltPopover(null)}>OK</Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    } else {
                      // Split text into words
                      const parts = t.value.split(/(\s+)/);
                      for (const part of parts) {
                        if (part.match(/^\s+$/)) {
                          elements.push(<span key={keyIdx++}>{part}</span>);
                        } else if (part) {
                          elements.push(
                            <span
                              key={keyIdx++}
                              className="cursor-pointer hover:bg-primary/10 rounded px-0.5 transition-colors"
                              onClick={() => handleWordClick(gi, part)}
                              title="Klikněte pro označení jako mezera"
                            >
                              {part}
                            </span>
                          );
                        }
                      }
                    }
                  });
                  return elements;
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Blanks summary */}
      {blanksCount > 0 && (
        <div className="text-xs text-muted-foreground">
          <Label className="text-xs">Označené mezery ({blanksCount}):</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tokens.filter(t => t.type === "blank").map((t, i) => (
              <span key={i} className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                {(t as any).answer}{(t as any).alternatives?.length ? ` (${(t as any).alternatives.join(", ")})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
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

const OrderingEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const ordering = props.ordering || { items: [""] };
  const updateItem = (idx: number, val: string) => {
    const items = ordering.items.map((it: string, i: number) => (i === idx ? val : it));
    onChange({ ...props, ordering: { ...ordering, items } });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Pořadí položek zde definuje správné řešení. Student je uvidí zamíchané.</p>
      <div className="space-y-1">
        {ordering.items.map((item: string, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">
              {i + 1}
            </span>
            <Input
              className="flex-1"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={`Krok ${i + 1}`}
            />
            {ordering.items.length > 1 && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...props, ordering: { ...ordering, items: ordering.items.filter((_: any, j: number) => j !== i) } })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={() => onChange({ ...props, ordering: { ...ordering, items: [...ordering.items, ""] } })}>
        <Plus className="w-3 h-3 mr-1" />Přidat položku
      </Button>
    </div>
  );
};

const ImageHotspotEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const hs = props.imageHotspot || { imageUrl: "", hotspots: [] };
  const imgRef = React.useRef<HTMLDivElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `image-hotspot/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (error) return;
    const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
    onChange({ ...props, imageHotspot: { ...hs, imageUrl: data.publicUrl } });
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const hotspots = [...hs.hotspots, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, radius: 8, label: "" }];
    onChange({ ...props, imageHotspot: { ...hs, hotspots } });
  };

  const updateHotspot = (idx: number, field: string, val: any) => {
    const hotspots = hs.hotspots.map((h: any, i: number) => (i === idx ? { ...h, [field]: val } : h));
    onChange({ ...props, imageHotspot: { ...hs, hotspots } });
  };

  const removeHotspot = (idx: number) => {
    onChange({ ...props, imageHotspot: { ...hs, hotspots: hs.hotspots.filter((_: any, i: number) => i !== idx) } });
  };

  return (
    <div className="space-y-3">
      {!hs.imageUrl ? (
        <label className="flex items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nahrát obrázek</span>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Kliknutím na obrázek definujete klikací oblast (hotspot):</p>
          <div ref={imgRef} className="relative cursor-crosshair inline-block w-full" onClick={handleImageClick}>
            <img src={hs.imageUrl} alt="" className="w-full rounded-lg" draggable={false} />
            {hs.hotspots.map((h: any, i: number) => (
              <div
                key={i}
                className="absolute rounded-full border-2 border-primary bg-primary/20 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${(h.radius || 8) * 2}%`, height: `${(h.radius || 8) * 2}%` }}
              >
                <span className="text-xs font-bold text-primary bg-background/80 px-1 rounded">{i + 1}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...props, imageHotspot: { ...hs, imageUrl: "" } })}>
            Změnit obrázek
          </Button>
        </div>
      )}

      {hs.hotspots.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Hotspoty (otázky / názvy oblastí)</Label>
          {hs.hotspots.map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </span>
              <Input
                className="flex-1"
                placeholder={`Otázka/název oblasti ${i + 1}`}
                value={h.label}
                onChange={(e) => updateHotspot(i, "label", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Label className="text-xs whitespace-nowrap">R: {h.radius || 8}%</Label>
                <Slider
                  min={3}
                  max={20}
                  step={1}
                  value={[h.radius || 8]}
                  onValueChange={([v]) => updateHotspot(i, "radius", v)}
                  className="w-20"
                />
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeHotspot(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FillChoiceEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const fc = props.fillChoice || { tokens: [], options: [] };

  const getTokens = (): { type: "text" | "blank"; value?: string; answer?: string }[] => {
    return fc.tokens && fc.tokens.length > 0 ? fc.tokens : [];
  };
  const tokens = getTokens();

  const [rawText, setRawText] = useState("");
  const [editingText, setEditingText] = useState(false);

  const updateTokens = (newTokens: any[]) => {
    // Auto-collect unique blank answers as options
    const blankAnswers = newTokens.filter((t: any) => t.type === "blank").map((t: any) => t.answer);
    const existingOptions = fc.options || [];
    // Merge: keep existing + add new blank answers
    const merged = [...new Set([...existingOptions, ...blankAnswers])].filter(Boolean);
    onChange({ ...props, fillChoice: { ...fc, tokens: newTokens, options: merged } });
  };

  const handleStartEdit = () => {
    const text = tokens.map((t: any) => t.type === "text" ? t.value : `{{${t.answer}}}`).join("");
    setRawText(text);
    setEditingText(true);
  };

  const handleFinishEdit = () => {
    // Parse {{answer}} syntax
    const newTokens: any[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      if (match.index > last) newTokens.push({ type: "text", value: rawText.slice(last, match.index) });
      newTokens.push({ type: "blank", answer: match[1].trim() });
      last = regex.lastIndex;
    }
    if (last < rawText.length) newTokens.push({ type: "text", value: rawText.slice(last) });
    updateTokens(newTokens);
    setEditingText(false);
  };

  const toggleBlank = (tokenIdx: number) => {
    const t = tokens[tokenIdx];
    if (!t) return;
    if (t.type === "blank") {
      const newTokens = [...tokens];
      newTokens[tokenIdx] = { type: "text", value: t.answer || "" };
      updateTokens(newTokens);
    }
  };

  const handleWordClick = (tokenIdx: number, wordStart: number, word: string) => {
    const t = tokens[tokenIdx];
    if (!t || t.type !== "text") return;
    const text = t.value || "";
    const before = text.slice(0, wordStart);
    const after = text.slice(wordStart + word.length);
    const newTokens = [...tokens];
    const replacement: any[] = [];
    if (before) replacement.push({ type: "text", value: before });
    replacement.push({ type: "blank", answer: word });
    if (after) replacement.push({ type: "text", value: after });
    newTokens.splice(tokenIdx, 1, ...replacement);
    updateTokens(newTokens);
  };

  const blanksCount = tokens.filter((t: any) => t.type === "blank").length;

  return (
    <div className="space-y-3">
      {editingText ? (
        <div className="space-y-2">
          <Label className="text-xs">Text (mezery označte {"{{slovo}}"})</Label>
          <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={4} />
          <Button size="sm" onClick={handleFinishEdit}>Uložit text</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Klikněte na slovo pro vytvoření mezery:</Label>
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              {tokens.length === 0 ? "Zadat text" : "Editovat text"}
            </Button>
          </div>
          {tokens.length > 0 && (
            <div className="rounded-lg border border-border bg-card/50 p-3 text-sm leading-relaxed flex flex-wrap gap-y-1">
              {tokens.map((token: any, ti: number) => {
                if (token.type === "blank") {
                  return (
                    <button
                      key={ti}
                      onClick={() => toggleBlank(ti)}
                      className="bg-primary/20 text-primary px-1.5 py-0.5 rounded mx-0.5 text-sm font-medium border border-primary/30 hover:bg-primary/30"
                      title="Klikni pro zrušení mezery"
                    >
                      {token.answer}
                    </button>
                  );
                }
                const text = token.value || "";
                const words = text.split(/(\s+)/);
                let offset = 0;
                return words.map((word: string, wi: number) => {
                  const start = offset;
                  offset += word.length;
                  if (/^\s+$/.test(word)) return <span key={`${ti}-${wi}`}>{word}</span>;
                  return (
                    <button
                      key={`${ti}-${wi}`}
                      onClick={() => handleWordClick(ti, start, word)}
                      className="hover:bg-primary/10 hover:text-primary rounded px-0.5 transition-colors cursor-pointer"
                      title="Klikni pro označení jako mezera"
                    >
                      {word}
                    </button>
                  );
                });
              })}
            </div>
          )}
        </div>
      )}

      {blanksCount > 0 && (
        <div className="text-xs text-muted-foreground">
          <Label className="text-xs">Mezery ({blanksCount}):</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tokens.filter((t: any) => t.type === "blank").map((t: any, i: number) => (
              <span key={i} className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                {t.answer}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Extra options (distractors) */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs">Nabídka slov (včetně chybných možností)</Label>
        <p className="text-xs text-muted-foreground">Správná slova se přidávají automaticky. Přidejte zde navíc špatné možnosti (distraktory).</p>
        <div className="flex flex-wrap gap-1.5">
          {(fc.options || []).map((opt: string, i: number) => {
            const isBlankAnswer = tokens.some((t: any) => t.type === "blank" && t.answer === opt);
            return (
              <span key={i} className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${isBlankAnswer ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {opt}
                {!isBlankAnswer && (
                  <button className="hover:text-destructive" onClick={() => {
                    const opts = (fc.options || []).filter((_: any, j: number) => j !== i);
                    onChange({ ...props, fillChoice: { ...fc, options: opts } });
                  }}>✕</button>
                )}
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Přidat špatnou možnost…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                const val = (e.target as HTMLInputElement).value.trim();
                onChange({ ...props, fillChoice: { ...fc, options: [...(fc.options || []), val] } });
                (e.target as HTMLInputElement).value = "";
              }
            }}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};

const TrueFalseEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const tf = props.trueFalse || { statements: [{ text: "", isTrue: true }] };
  const updateStatement = (idx: number, field: string, val: any) => {
    const statements = tf.statements.map((s: any, i: number) => (i === idx ? { ...s, [field]: val } : s));
    onChange({ ...props, trueFalse: { ...tf, statements } });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Zadejte tvrzení a označte, zda je pravdivé nebo nepravdivé.</p>
      {tf.statements.map((s: any, i: number) => (
        <div key={i} className="flex items-center gap-2 border border-border rounded-lg p-3">
          <Input
            className="flex-1"
            value={s.text}
            onChange={(e) => updateStatement(i, "text", e.target.value)}
            placeholder={`Tvrzení ${i + 1}`}
          />
          <Select value={s.isTrue ? "true" : "false"} onValueChange={(v) => updateStatement(i, "isTrue", v === "true")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Pravda</SelectItem>
              <SelectItem value="false">Nepravda</SelectItem>
            </SelectContent>
          </Select>
          {tf.statements.length > 1 && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...props, trueFalse: { ...tf, statements: tf.statements.filter((_: any, j: number) => j !== i) } })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...props, trueFalse: { ...tf, statements: [...tf.statements, { text: "", isTrue: true }] } })}>
        <Plus className="w-3 h-3 mr-1" />Přidat tvrzení
      </Button>
    </div>
  );
};

const RevealCardsEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const rc = props.revealCards || { cards: [{ title: "", content: "" }] };
  const updateCard = (idx: number, field: string, val: string) => {
    const cards = rc.cards.map((c: any, i: number) => (i === idx ? { ...c, [field]: val } : c));
    onChange({ ...props, revealCards: { ...rc, cards } });
  };
  return (
    <div className="space-y-3">
      {rc.cards.map((card: any, i: number) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Kartička {i + 1}</span>
            {rc.cards.length > 1 && (
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onChange({ ...props, revealCards: { ...rc, cards: rc.cards.filter((_: any, j: number) => j !== i) } })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Input placeholder="Název kartičky" value={card.title} onChange={(e) => updateCard(i, "title", e.target.value)} />
          <Textarea placeholder="Obsah (otázka, úkol, text…)" value={card.content} onChange={(e) => updateCard(i, "content", e.target.value)} rows={2} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...props, revealCards: { ...rc, cards: [...rc.cards, { title: "", content: "" }] } })}>
        <Plus className="w-3 h-3 mr-1" />Přidat kartičku
      </Button>
    </div>
  );
};

const MemoryGameEditor = ({ props, onChange }: { props: any; onChange: (p: any) => void }) => {
  const mg = props.memoryGame || { pairs: [{ left: "", right: "" }] };
  const updatePair = (idx: number, field: string, val: string) => {
    const pairs = mg.pairs.map((p: any, i: number) => (i === idx ? { ...p, [field]: val } : p));
    onChange({ ...props, memoryGame: { ...mg, pairs } });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Zadejte dvojice – např. pojem a jeho definici. Student hledá shodné páry.</p>
      {mg.pairs.map((pair: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="flex-1" placeholder={`Pojem ${i + 1}`} value={pair.left} onChange={(e) => updatePair(i, "left", e.target.value)} />
          <span className="text-muted-foreground text-xs">↔</span>
          <Input className="flex-1" placeholder={`Definice ${i + 1}`} value={pair.right} onChange={(e) => updatePair(i, "right", e.target.value)} />
          {mg.pairs.length > 1 && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onChange({ ...props, memoryGame: { ...mg, pairs: mg.pairs.filter((_: any, j: number) => j !== i) } })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...props, memoryGame: { ...mg, pairs: [...mg.pairs, { left: "", right: "" }] } })}>
        <Plus className="w-3 h-3 mr-1" />Přidat pár
      </Button>
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
      {activityType === "ordering" && <OrderingEditor props={p} onChange={onChange} />}
      {activityType === "image_label" && <ImageLabelEditor props={p} onChange={onChange} />}
      {activityType === "image_hotspot" && <ImageHotspotEditor props={p} onChange={onChange} />}
      {activityType === "fill_blanks" && <FillBlanksEditor props={p} onChange={onChange} />}
      {activityType === "fill_choice" && <FillChoiceEditor props={p} onChange={onChange} />}
      {activityType === "true_false" && <TrueFalseEditor props={p} onChange={onChange} />}
      {activityType === "reveal_cards" && <RevealCardsEditor props={p} onChange={onChange} />}
    </div>
  );
};

export default ActivityBlock;
