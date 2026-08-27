/**
 * Editor specifikací aktivit, které se v živé prezentaci vykreslují
 * přes `LessonBlockRenderer` (doplňovačky, aktivní body v obrázku, křížovka).
 *
 * Pracuje přímo se `activitySpec` slidu a udržuje stejný tvar dat,
 * jaký používají aktivity v učebnici (`fillBlanks`, `fillChoice`,
 * `imageHotspot`, `crossword`).
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";

export type LiveSpecActivityType =
  | "fill_blanks"
  | "fill_choice"
  | "image_hotspot"
  | "crossword"
  | "flashcards"
  | "reveal_cards"
  | "memory_game"
  | "image_label"
  | "true_false"
  | "matching"
  | "ordering"
  | "sorting";

export const LIVE_SPEC_ACTIVITY_TYPES: LiveSpecActivityType[] = [
  "fill_blanks",
  "fill_choice",
  "image_hotspot",
  "crossword",
  "flashcards",
  "reveal_cards",
  "memory_game",
  "image_label",
  "true_false",
  "matching",
  "ordering",
  "sorting",
];

export const isLiveSpecActivityType = (t?: string): t is LiveSpecActivityType =>
  LIVE_SPEC_ACTIVITY_TYPES.includes(t as LiveSpecActivityType);

interface Props {
  spec: any;
  onChange: (patch: Record<string, unknown>) => void;
  /** Otevře knihovnu médií a vrátí URL obrázku. */
  onPickImage?: (apply: (url: string) => void) => void;
}

/** `Text {{odpověď}} text` → tokeny pro FillChoiceActivity. */
export const textToChoiceTokens = (text: string) => {
  const tokens: { type: "text" | "blank"; value?: string; answer?: string }[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    tokens.push({ type: "blank", answer: m[1].split("/")[0].trim() });
    last = regex.lastIndex;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
};

/** Tokeny → editovatelný text se `{{...}}`. */
export const choiceTokensToText = (tokens: any[] = []) =>
  tokens
    .map((t) => (t?.type === "blank" ? `{{${t.answer ?? ""}}}` : t?.value ?? ""))
    .join("");

const HintRow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>
);

interface PairRowsProps {
  title: string;
  hint?: string;
  rows: any[];
  leftKey: string;
  rightKey: string;
  leftPlaceholder: string;
  rightPlaceholder: string;
  addLabel: string;
  onChange: (next: any[]) => void;
}

/** Sdílený editor dvousloupcových seznamů (kartičky, pexeso, dvojice A–B). */
const PairListEditor = ({
  title,
  hint,
  rows,
  leftKey,
  rightKey,
  leftPlaceholder,
  rightPlaceholder,
  addLabel,
  onChange,
}: PairRowsProps) => (
  <div className="space-y-2 border-t border-border pt-3">
    <Label className="text-xs">{title}</Label>
    {hint && <HintRow>{hint}</HintRow>}
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            className="h-7 text-xs"
            value={row?.[leftKey] || ""}
            onChange={(e) => onChange(rows.map((x, idx) => (idx === i ? { ...x, [leftKey]: e.target.value } : x)))}
            placeholder={leftPlaceholder}
          />
          <Input
            className="h-7 text-xs"
            value={row?.[rightKey] || ""}
            onChange={(e) => onChange(rows.map((x, idx) => (idx === i ? { ...x, [rightKey]: e.target.value } : x)))}
            placeholder={rightPlaceholder}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            aria-label="Odebrat řádek"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 w-full text-xs"
      onClick={() => onChange([...rows, { [leftKey]: "", [rightKey]: "" }])}
    >
      <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
    </Button>
  </div>
);

const LiveActivitySpecEditor = ({ spec, onChange, onPickImage }: Props) => {
  const type = spec?.activityType as string | undefined;

  if (type === "fill_blanks") {
    const fb = spec?.fillBlanks || {};
    const patchFb = (patch: Record<string, unknown>) =>
      onChange({ fillBlanks: { ...fb, ...patch } });
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Text s mezerami</Label>
        <Textarea
          rows={4}
          className="text-xs"
          value={fb.text || ""}
          onChange={(e) => patchFb({ text: e.target.value })}
          placeholder="Hlavní město Česka je {{Praha}}."
        />
        <HintRow>
          Správnou odpověď napište do dvojitých složených závorek. Více variant oddělte lomítkem:
          <code className="mx-1">{"{{Praha/praha}}"}</code>.
        </HintRow>
        <div className="flex items-center gap-2">
          <Checkbox
            id="fb-case"
            checked={fb.caseSensitive === true}
            onCheckedChange={(v) => patchFb({ caseSensitive: !!v })}
          />
          <Label htmlFor="fb-case" className="cursor-pointer text-xs">Rozlišovat velká písmena</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="fb-diacritics"
            checked={fb.diacriticSensitive !== false}
            onCheckedChange={(v) => patchFb({ diacriticSensitive: !!v })}
          />
          <Label htmlFor="fb-diacritics" className="cursor-pointer text-xs">Vyžadovat diakritiku</Label>
        </div>
      </div>
    );
  }

  if (type === "fill_choice") {
    const fc = spec?.fillChoice || {};
    const tokens: any[] = Array.isArray(fc.tokens) ? fc.tokens : [];
    const options: string[] = Array.isArray(fc.options) ? fc.options : [];
    const answers = tokens.filter((t) => t?.type === "blank").map((t) => String(t.answer ?? ""));
    const distractors = options.filter((o) => !answers.includes(o));
    const patchFc = (patch: Record<string, unknown>) =>
      onChange({ fillChoice: { ...fc, ...patch } });

    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Text s mezerami</Label>
        <Textarea
          rows={4}
          className="text-xs"
          value={choiceTokensToText(tokens)}
          onChange={(e) => {
            const next = textToChoiceTokens(e.target.value);
            const nextAnswers = next.filter((t) => t.type === "blank").map((t) => t.answer || "");
            patchFc({ tokens: next, options: [...nextAnswers, ...distractors].filter(Boolean) });
          }}
          placeholder="Voda vře při {{100}} °C."
        />
        <HintRow>Odpovědi v <code>{"{{ }}"}</code> se automaticky přidají do nabídky slov.</HintRow>
        <Label className="text-xs">Slova na svedení (nepovinné, oddělte čárkou)</Label>
        <Input
          className="h-8 text-xs"
          value={distractors.join(", ")}
          onChange={(e) => {
            const extra = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            patchFc({ options: [...answers, ...extra] });
          }}
          placeholder="90, 120"
        />
      </div>
    );
  }

  if (type === "image_hotspot") {
    const ih = spec?.imageHotspot || {};
    const hotspots: any[] = Array.isArray(ih.hotspots) ? ih.hotspots : [];
    const patchIh = (patch: Record<string, unknown>) =>
      onChange({ imageHotspot: { ...ih, ...patch } });
    const setHotspot = (i: number, patch: Record<string, unknown>) =>
      patchIh({ hotspots: hotspots.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });

    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Obrázek</Label>
        <div className="flex gap-1.5">
          <Input
            className="h-8 text-xs"
            value={ih.imageUrl || ""}
            onChange={(e) => patchIh({ imageUrl: e.target.value })}
            placeholder="https://…"
          />
          {onPickImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2 text-xs"
              onClick={() => onPickImage((url) => patchIh({ imageUrl: url }))}
            >
              Knihovna
            </Button>
          )}
        </div>
        {ih.imageUrl && (
          <img
            src={ih.imageUrl}
            alt="Náhled obrázku aktivity"
            className="max-h-32 w-full rounded-md border border-border object-contain"
          />
        )}
        <Label className="text-xs">Aktivní body</Label>
        <HintRow>Souřadnice X/Y jsou v procentech obrázku, tolerance je poloměr v procentech.</HintRow>
        <div className="space-y-2">
          {hotspots.map((h, i) => (
            <div key={i} className="space-y-1 rounded-md border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  className="h-7 text-xs"
                  value={h.label || ""}
                  onChange={(e) => setHotspot(i, { label: e.target.value })}
                  placeholder="Zadání: klikni na…"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => patchIh({ hotspots: hotspots.filter((_, idx) => idx !== i) })}
                  aria-label="Odebrat aktivní bod"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["x", "y", "radius"] as const).map((key) => (
                  <div key={key}>
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      {key === "radius" ? "tolerance" : key}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-7 text-xs"
                      value={h[key] ?? (key === "radius" ? 8 : 50)}
                      onChange={(e) => setHotspot(i, { [key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() =>
            patchIh({ hotspots: [...hotspots, { label: "", x: 50, y: 50, radius: 8 }] })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat aktivní bod
        </Button>
      </div>
    );
  }

  if (type === "crossword") {
    const cw = spec?.crossword || {};
    const entries: any[] = Array.isArray(cw.entries) ? cw.entries : [];
    const patchEntries = (next: any[]) => onChange({ crossword: { ...cw, entries: next } });

    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Tajenka a nápovědy</Label>
        <HintRow>Nejlépe 5–10 slov bez diakritiky a mezer, aby se mřížka dobře poskládala.</HintRow>
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                className="h-7 w-24 shrink-0 text-xs uppercase"
                value={e.answer || ""}
                onChange={(ev) =>
                  patchEntries(entries.map((x, idx) => (idx === i ? { ...x, answer: ev.target.value } : x)))
                }
                placeholder="SLOVO"
              />
              <Input
                className="h-7 text-xs"
                value={e.clue || ""}
                onChange={(ev) =>
                  patchEntries(entries.map((x, idx) => (idx === i ? { ...x, clue: ev.target.value } : x)))
                }
                placeholder="Nápověda"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => patchEntries(entries.filter((_, idx) => idx !== i))}
                aria-label="Odebrat slovo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => patchEntries([...entries, { answer: "", clue: "" }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat slovo
        </Button>
      </div>
    );
  }


  if (type === "flashcards") {
    const cards: any[] = Array.isArray(spec?.flashcards) ? spec.flashcards : [];
    const patch = (next: any[]) => onChange({ flashcards: next });
    return (
      <PairListEditor
        title="Kartičky"
        hint="Žák klikne na kartičku a otočí ji na zadní stranu."
        rows={cards}
        leftKey="front"
        rightKey="back"
        leftPlaceholder="Přední strana"
        rightPlaceholder="Zadní strana"
        addLabel="Přidat kartičku"
        onChange={patch}
      />
    );
  }

  if (type === "reveal_cards") {
    const rc = spec?.revealCards || {};
    const cards: any[] = Array.isArray(rc.cards) ? rc.cards : [];
    return (
      <PairListEditor
        title="Kartičky k odhalení"
        hint="Nadpis je vidět vždy, obsah se odhalí po kliknutí."
        rows={cards}
        leftKey="title"
        rightKey="content"
        leftPlaceholder="Nadpis"
        rightPlaceholder="Skrytý obsah"
        addLabel="Přidat kartičku"
        onChange={(next) => onChange({ revealCards: { ...rc, cards: next } })}
      />
    );
  }

  if (type === "memory_game") {
    const mg = spec?.memoryGame || {};
    const pairs: any[] = Array.isArray(mg.pairs) ? mg.pairs : [];
    return (
      <PairListEditor
        title="Dvojice pro pexeso"
        hint="Každá dvojice vytvoří dvě kartičky, které k sobě patří."
        rows={pairs}
        leftKey="left"
        rightKey="right"
        leftPlaceholder="Pojem"
        rightPlaceholder="Dvojice"
        addLabel="Přidat dvojici"
        onChange={(next) => onChange({ memoryGame: { ...mg, pairs: next } })}
      />
    );
  }

  if (type === "matching") {
    const m = spec?.matching || {};
    const left: string[] = Array.isArray(m.left) ? m.left : [];
    const right: string[] = Array.isArray(m.right) ? m.right : [];
    const rows = left.map((l, i) => ({ left: l, right: right[i] ?? "" }));
    const apply = (next: any[]) =>
      onChange({
        matching: {
          ...m,
          left: next.map((r) => r.left ?? ""),
          right: next.map((r) => r.right ?? ""),
        },
      });
    return (
      <PairListEditor
        title="Dvojice A–B"
        hint="Pravá strana se žákům zamíchá, správné je vždy pořadí řádku."
        rows={rows}
        leftKey="left"
        rightKey="right"
        leftPlaceholder="Pojem A"
        rightPlaceholder="Odpověď B"
        addLabel="Přidat dvojici"
        onChange={apply}
      />
    );
  }

  if (type === "ordering") {
    const o = spec?.ordering || {};
    const items: string[] = Array.isArray(o.items) ? o.items : [];
    const patchItems = (next: string[]) => onChange({ ordering: { ...o, items: next } });
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Správné pořadí</Label>
        <HintRow>Zapište položky ve správném pořadí, žákům se zamíchají.</HintRow>
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-[11px] text-muted-foreground">{i + 1}.</span>
              <Input
                className="h-7 text-xs"
                value={it}
                onChange={(e) => patchItems(items.map((x, idx) => (idx === i ? e.target.value : x)))}
                placeholder="Krok"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => patchItems(items.filter((_, idx) => idx !== i))}
                aria-label="Odebrat položku"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => patchItems([...items, ""])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat položku
        </Button>
      </div>
    );
  }

  if (type === "sorting") {
    const so = spec?.sorting || {};
    const groups: string[] = Array.isArray(so.groups) ? so.groups : [];
    const items: any[] = Array.isArray(so.items) ? so.items : [];
    const patchSo = (patch: Record<string, unknown>) => onChange({ sorting: { ...so, ...patch } });
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Skupiny</Label>
        <div className="space-y-1.5">
          {groups.map((g, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                className="h-7 text-xs"
                value={g}
                onChange={(e) => patchSo({ groups: groups.map((x, idx) => (idx === i ? e.target.value : x)) })}
                placeholder={`Skupina ${i + 1}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() =>
                  patchSo({
                    groups: groups.filter((_, idx) => idx !== i),
                    items: items
                      .filter((it) => it.group !== i)
                      .map((it) => ({ ...it, group: it.group > i ? it.group - 1 : it.group })),
                  })
                }
                aria-label="Odebrat skupinu"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => patchSo({ groups: [...groups, ""] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat skupinu
        </Button>

        <Label className="text-xs">Položky k roztřídění</Label>
        <HintRow>U každé položky vyberte skupinu, do které správně patří.</HintRow>
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                className="h-7 text-xs"
                value={it.text || ""}
                onChange={(e) =>
                  patchSo({ items: items.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)) })
                }
                placeholder="Položka"
              />
              <select
                className="h-7 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs"
                value={String(it.group ?? 0)}
                onChange={(e) =>
                  patchSo({
                    items: items.map((x, idx) => (idx === i ? { ...x, group: Number(e.target.value) } : x)),
                  })
                }
                aria-label="Skupina položky"
              >
                {groups.map((g, gi) => (
                  <option key={gi} value={gi}>{g || `Skupina ${gi + 1}`}</option>
                ))}
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => patchSo({ items: items.filter((_, idx) => idx !== i) })}
                aria-label="Odebrat položku"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => patchSo({ items: [...items, { text: "", group: 0 }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat položku
        </Button>
      </div>
    );
  }

  if (type === "true_false") {
    const tf = spec?.trueFalse || {};
    const statements: any[] = Array.isArray(tf.statements) ? tf.statements : [];
    const patchSt = (next: any[]) => onChange({ trueFalse: { ...tf, statements: next } });
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Tvrzení</Label>
        <HintRow>Zaškrtnuté tvrzení je pravdivé.</HintRow>
        <div className="space-y-1.5">
          {statements.map((st, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Checkbox
                checked={st.isTrue === true}
                onCheckedChange={(v) =>
                  patchSt(statements.map((x, idx) => (idx === i ? { ...x, isTrue: !!v } : x)))
                }
                aria-label="Tvrzení je pravdivé"
              />
              <Input
                className="h-7 text-xs"
                value={st.text || ""}
                onChange={(e) =>
                  patchSt(statements.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))
                }
                placeholder="Tvrzení"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => patchSt(statements.filter((_, idx) => idx !== i))}
                aria-label="Odebrat tvrzení"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => patchSt([...statements, { text: "", isTrue: true }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat tvrzení
        </Button>
      </div>
    );
  }

  if (type === "image_label") {
    const il = spec?.imageLabel || {};
    const markers: any[] = Array.isArray(il.markers) ? il.markers : [];
    const patchIl = (patch: Record<string, unknown>) => onChange({ imageLabel: { ...il, ...patch } });
    const setMarker = (i: number, patch: Record<string, unknown>) =>
      patchIl({ markers: markers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">Obrázek</Label>
        <div className="flex gap-1.5">
          <Input
            className="h-8 text-xs"
            value={il.imageUrl || ""}
            onChange={(e) => patchIl({ imageUrl: e.target.value })}
            placeholder="https://…"
          />
          {onPickImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2 text-xs"
              onClick={() => onPickImage((url) => patchIl({ imageUrl: url }))}
            >
              Knihovna
            </Button>
          )}
        </div>
        {il.imageUrl && (
          <img
            src={il.imageUrl}
            alt="Náhled obrázku aktivity"
            className="max-h-32 w-full rounded-md border border-border object-contain"
          />
        )}
        <Label className="text-xs">Popisky a jejich místa</Label>
        <HintRow>Souřadnice X/Y jsou v procentech obrázku.</HintRow>
        <div className="space-y-2">
          {markers.map((m, i) => (
            <div key={i} className="space-y-1 rounded-md border border-border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  className="h-7 text-xs"
                  value={m.label || ""}
                  onChange={(e) => setMarker(i, { label: e.target.value })}
                  placeholder="Popisek"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => patchIl({ markers: markers.filter((_, idx) => idx !== i) })}
                  aria-label="Odebrat popisek"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["x", "y"] as const).map((key) => (
                  <div key={key}>
                    <Label className="text-[10px] uppercase text-muted-foreground">{key}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-7 text-xs"
                      value={m[key] ?? 50}
                      onChange={(e) => setMarker(i, { [key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => patchIl({ markers: [...markers, { label: "", x: 50, y: 50 }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat popisek
        </Button>
        <div className="flex items-center gap-2">
          <Checkbox
            id="il-shuffle"
            checked={il.shuffleWords !== false}
            onCheckedChange={(v) => patchIl({ shuffleWords: !!v })}
          />
          <Label htmlFor="il-shuffle" className="cursor-pointer text-xs">Zamíchat popisky</Label>
        </div>
      </div>
    );
  }

  return null;
};

export default LiveActivitySpecEditor;
