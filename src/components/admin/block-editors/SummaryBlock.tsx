import { useState } from "react";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import MiniRichEditor from "./MiniRichEditor";
import LessonSourcePickerDialog, {
  MAX_AI_SOURCE_CHARS,
} from "./LessonSourcePickerDialog";
import AiContentBadge from "@/components/ai/AiContentBadge";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const SummaryAiPanel = ({ block, onChange }: Props) => {
  const p = block.props || {};
  const [open, setOpen] = useState(!!p.aiSourceText);
  const [context, setContext] = useState<string>(p.aiSourceText || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceNote, setSourceNote] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-activity-content",
        {
          body: {
            activityType: "summary",
            topic: p.title || "Shrnutí lekce",
            context,
          },
        },
      );
      if (fnError) throw fnError;
      if ((data as any)?.error) throw new Error((data as any).error);
      const generated = (data as any)?.props;
      const summary = generated?.summary ?? generated;
      const text: string =
        typeof summary?.text === "string"
          ? summary.text
          : Array.isArray(summary?.items)
            ? `<ul>${summary.items
                .map((i: any) => `<li>${typeof i === "string" ? i : i?.text ?? ""}</li>`)
                .join("")}</ul>`
            : "";
      if (!text.trim()) throw new Error("AI nevrátila použitelné shrnutí.");
      onChange({
        ...p,
        title: summary?.title || generated?.title || p.title || "Shrnutí lekce",
        text,
        aiSourceText: context || undefined,
        ai_generated: true,
        ai_modified_at: null,
      });
    } catch (e: any) {
      console.error("generate summary failed:", e);
      setError(e?.message || "Shrnutí se nepodařilo vytvořit. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      {!open ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="w-3.5 h-3.5" /> Navrhnout pomocí AI
        </Button>
      ) : (
        <>
          <Label className="text-xs">Z čeho má AI vycházet (téma, text, poznámky)</Label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            placeholder="Vložte text lekce nebo jen téma, které se má shrnout."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setPickerOpen(true)}
            >
              <BookOpen className="w-3.5 h-3.5" /> Vybrat obsah z lekcí
            </Button>
            {sourceNote && (
              <span className="text-xs text-muted-foreground">{sourceNote}</span>
            )}
          </div>
          <LessonSourcePickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPicked={(text, truncated) => {
              setContext((prev) => {
                const merged = prev.trim() ? `${prev.trim()}\n\n${text}` : text;
                return merged.length > MAX_AI_SOURCE_CHARS
                  ? `${merged.slice(0, MAX_AI_SOURCE_CHARS)}…`
                  : merged;
              });
              setSourceNote(
                truncated
                  ? "Obsah lekcí byl zkrácen na maximální délku podkladu pro AI."
                  : "Obsah vybraných lekcí byl přidán do podkladu.",
              );
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {loading ? "Generuji…" : "Vygenerovat shrnutí"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Skrýt
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
};

const SummaryBlock = ({ block, onChange }: Props) => (
  <div className="space-y-2">
    <SummaryAiPanel block={block} onChange={onChange} />
    <div>
      <div className="flex items-center gap-2">
        <Label className="text-xs">Nadpis shrnutí</Label>
        <AiContentBadge
          aiGenerated={block.props.ai_generated}
          aiModifiedAt={block.props.ai_modified_at}
        />
      </div>
      <Input
        value={block.props.title || ""}
        onChange={(e) => onChange({ ...block.props, title: e.target.value })}
        placeholder="Shrnutí lekce"
        className="mt-1"
      />
    </div>
    <MiniRichEditor
      content={block.props.text || ""}
      onChange={(html) => onChange({ ...block.props, text: html })}
      placeholder="Klíčové body lekce…"
      showHeadings={false}
      showLists
      minHeight="100px"
    />
  </div>
);

export default SummaryBlock;
