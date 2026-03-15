/**
 * WorksheetPlayer — Interactive web renderer for WorksheetSpec.
 *
 * Renders MCQ, matching (keyboard-accessible select), short/open answer,
 * fill_blank, true_false, and ordering items.
 *
 * Features:
 *   - Dual-layer autosave (localStorage + server)
 *   - Submit locks answers (when enabled)
 *   - Keyboard-accessible matching via <select> dropdowns
 *   - Progress bar + item navigation
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useWorksheetAutosave, type WorksheetAnswers } from "@/hooks/useWorksheetAutosave";
import { t } from "@/lib/t";
import type {
  WorksheetSpec,
  WorksheetVariant,
  WorksheetItem,
  AnswerKeyEntry,
} from "@/lib/worksheet-spec";

// ────────────────── Types ──────────────────

export interface WorksheetPlayerProps {
  spec: WorksheetSpec;
  variantId: string;
  /** Supabase attempt id for server persistence (null = local only) */
  attemptId?: string | null;
  /** Autosave interval in seconds */
  autosaveIntervalSec?: number;
  /** Called when student submits */
  onSubmit?: (answers: WorksheetAnswers, score: number, maxScore: number) => void;
  /** If true, answers are locked (already submitted) */
  locked?: boolean;
  /** Show correct answers after submit */
  showResults?: boolean;
  /** Pre-loaded answers (e.g. from server restore) */
  initialAnswers?: WorksheetAnswers;
}

// ────────────────── Scoring ──────────────────

function scoreWorksheet(
  items: WorksheetItem[],
  answers: WorksheetAnswers,
  answerKey: AnswerKeyEntry[],
): { score: number; maxScore: number; perItem: Record<string, { correct: boolean; points: number }> } {
  let score = 0;
  const maxScore = items.reduce((s, it) => s + it.points, 0);
  const perItem: Record<string, { correct: boolean; points: number }> = {};

  const keyMap = new Map(answerKey.map((k) => [k.itemId, k]));

  for (const item of items) {
    const key = keyMap.get(item.id);
    const answer = answers[item.id];
    if (!key || answer === undefined || answer === null || answer === "") {
      perItem[item.id] = { correct: false, points: 0 };
      continue;
    }

    let correct = false;
    const ca = key.correctAnswer;

    switch (item.type) {
      case "mcq":
      case "true_false":
        correct = String(answer).trim().toLowerCase() === String(ca).trim().toLowerCase();
        break;
      case "fill_blank":
        if (Array.isArray(ca)) {
          const userBlanks = Array.isArray(answer) ? answer : [answer];
          correct = ca.every((c, i) => String(userBlanks[i] ?? "").trim().toLowerCase() === c.trim().toLowerCase());
        } else {
          correct = String(answer).trim().toLowerCase() === String(ca).trim().toLowerCase();
        }
        break;
      case "matching":
        if (Array.isArray(ca) && Array.isArray(answer)) {
          correct = ca.length === answer.length && ca.every((c, i) => c === answer[i]);
        }
        break;
      case "ordering":
        if (Array.isArray(ca) && Array.isArray(answer)) {
          correct = ca.length === answer.length && ca.every((c, i) => c === answer[i]);
        }
        break;
      case "short_answer":
        correct = String(answer).trim().toLowerCase() === String(ca).trim().toLowerCase();
        break;
      case "open_answer":
        // open answers need manual grading — auto-score as 0
        correct = false;
        break;
    }

    perItem[item.id] = { correct, points: correct ? item.points : 0 };
    if (correct) score += item.points;
  }

  return { score, maxScore, perItem };
}

// ────────────────── Component ──────────────────

const CHOICE_LETTERS = "ABCDEFGHIJKLMNOP";

const TYPE_LABELS: Record<string, string> = {
  mcq: "Výběr z možností",
  fill_blank: "Doplňovačka",
  true_false: "Pravda / Nepravda",
  matching: "Spojování",
  ordering: "Seřazení",
  short_answer: "Krátká odpověď",
  open_answer: "Otevřená odpověď",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

export default function WorksheetPlayer({
  spec,
  variantId,
  attemptId = null,
  autosaveIntervalSec = 10,
  onSubmit,
  locked = false,
  showResults = false,
  initialAnswers,
}: WorksheetPlayerProps) {
  const variant = useMemo(
    () => spec.variants.find((v) => v.variantId === variantId),
    [spec, variantId],
  );
  const answerKey = useMemo(() => spec.answerKeys[variantId] ?? [], [spec, variantId]);

  const storageKey = `ws-${spec.metadata.lessonPlanId ?? "local"}-${variantId}-${attemptId ?? "draft"}`;

  const {
    answers,
    currentIndex,
    setAnswer,
    setCurrentIndex,
    isSaving,
    lastSavedAt,
    flushNow,
    restore,
  } = useWorksheetAutosave({
    storageKey,
    attemptId,
    intervalSec: autosaveIntervalSec,
    editable: !locked,
  });

  const [submitted, setSubmitted] = useState(locked);
  const [results, setResults] = useState<ReturnType<typeof scoreWorksheet> | null>(null);

  // Restore on mount
  useEffect(() => {
    if (initialAnswers) {
      Object.entries(initialAnswers).forEach(([k, v]) => setAnswer(k, v));
    } else {
      restore();
    }
  }, []);

  if (!variant) {
    return <div className="p-8 text-center text-muted-foreground">Varianta „{variantId}" nenalezena.</div>;
  }

  const items = variant.items;
  const item = items[currentIndex];
  const totalItems = items.length;
  const answeredCount = items.filter((it) => answers[it.id] !== undefined && answers[it.id] !== "" && answers[it.id] !== null).length;
  const progressPct = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;

  const itemResult = results?.perItem[item?.id];

  // ── Handlers ──

  const handleSubmit = async () => {
    if (submitted) return;
    await flushNow();
    const res = scoreWorksheet(items, answers, answerKey);
    setResults(res);
    setSubmitted(true);
    onSubmit?.(answers, res.score, res.maxScore);
    toast({
      title: t("student.toasts.submitted.title"),
      description: t("student.states.scoreResult", res.score, res.maxScore),
    });
  };

  const handleSaveNow = async () => {
    await flushNow();
    toast({ title: t("student.toasts.saved.title"), description: t("student.toasts.saved.description") });
  };

  // ── Item Renderers ──

  const renderMCQ = (it: WorksheetItem) => (
    <RadioGroup
      value={answers[it.id] ?? ""}
      onValueChange={(v) => setAnswer(it.id, v)}
      disabled={submitted}
      className="space-y-2"
    >
      {(it.choices ?? []).map((choice, i) => {
        const val = CHOICE_LETTERS[i];
        const isCorrect = showResults && results && String(answerKey.find((k) => k.itemId === it.id)?.correctAnswer) === val;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              submitted && isCorrect ? "border-green-500 bg-green-50" : "border-border"
            } ${submitted && answers[it.id] === val && !isCorrect ? "border-red-300 bg-red-50" : ""}`}
          >
            <RadioGroupItem value={val} id={`${it.id}-${val}`} />
            <Label htmlFor={`${it.id}-${val}`} className="flex-1 cursor-pointer text-sm">
              <span className="font-semibold mr-2 text-muted-foreground">{val}.</span>
              {choice}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );

  const renderTrueFalse = (it: WorksheetItem) => (
    <RadioGroup
      value={answers[it.id] ?? ""}
      onValueChange={(v) => setAnswer(it.id, v)}
      disabled={submitted}
      className="flex gap-4"
    >
      {["true", "false"].map((val) => (
        <div key={val} className="flex items-center gap-2 p-3 rounded-lg border border-border">
          <RadioGroupItem value={val} id={`${it.id}-${val}`} />
          <Label htmlFor={`${it.id}-${val}`} className="cursor-pointer">
            {val === "true" ? "Pravda" : "Nepravda"}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );

  const renderFillBlank = (it: WorksheetItem) => {
    const blanks = (it.blankText ?? "").split("___");
    const blankCount = blanks.length - 1;
    const currentAnswers = Array.isArray(answers[it.id]) ? answers[it.id] : Array(blankCount).fill("");

    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed">
          {blanks.map((segment, i) => (
            <span key={i}>
              {segment}
              {i < blankCount && (
                <Input
                  className="inline-block w-32 mx-1 h-8 text-sm"
                  value={currentAnswers[i] ?? ""}
                  disabled={submitted}
                  placeholder={`(${i + 1})`}
                  onChange={(e) => {
                    const next = [...currentAnswers];
                    next[i] = e.target.value;
                    setAnswer(it.id, next);
                  }}
                />
              )}
            </span>
          ))}
        </p>
      </div>
    );
  };

  const renderMatching = (it: WorksheetItem) => {
    const pairs = it.matchPairs ?? [];
    const rights = pairs.map((p) => p.right);
    const currentAnswers = Array.isArray(answers[it.id]) ? answers[it.id] : Array(pairs.length).fill("");

    return (
      <div className="space-y-3">
        {pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm font-medium min-w-[120px]">{pair.left}</span>
            <span className="text-muted-foreground">→</span>
            <Select
              value={currentAnswers[i] ?? ""}
              onValueChange={(v) => {
                const next = [...currentAnswers];
                next[i] = v;
                setAnswer(it.id, next);
              }}
              disabled={submitted}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vyberte…" />
              </SelectTrigger>
              <SelectContent>
                {rights.map((r, ri) => (
                  <SelectItem key={ri} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );
  };

  const renderOrdering = (it: WorksheetItem) => {
    const orderItems = it.orderItems ?? [];
    const currentOrder = Array.isArray(answers[it.id]) ? answers[it.id] : Array(orderItems.length).fill("");

    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">Přiřaďte pořadí (1, 2, 3…) ke každé položce:</p>
        {orderItems.map((text, i) => (
          <div key={i} className="flex items-center gap-3">
            <Input
              className="w-14 h-8 text-center text-sm"
              type="number"
              min={1}
              max={orderItems.length}
              value={currentOrder[i] ?? ""}
              disabled={submitted}
              onChange={(e) => {
                const next = [...currentOrder];
                next[i] = e.target.value;
                setAnswer(it.id, next);
              }}
            />
            <span className="text-sm">{text}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderShortAnswer = (it: WorksheetItem) => (
    <Input
      value={answers[it.id] ?? ""}
      onChange={(e) => setAnswer(it.id, e.target.value)}
      disabled={submitted}
      placeholder="Vaše odpověď…"
      className="max-w-md"
    />
  );

  const renderOpenAnswer = (it: WorksheetItem) => (
    <Textarea
      value={answers[it.id] ?? ""}
      onChange={(e) => setAnswer(it.id, e.target.value)}
      disabled={submitted}
      placeholder="Rozepište svou odpověď…"
      rows={5}
      className="max-w-lg"
    />
  );

  const renderItemBody = (it: WorksheetItem) => {
    switch (it.type) {
      case "mcq": return renderMCQ(it);
      case "true_false": return renderTrueFalse(it);
      case "fill_blank": return renderFillBlank(it);
      case "matching": return renderMatching(it);
      case "ordering": return renderOrdering(it);
      case "short_answer": return renderShortAnswer(it);
      case "open_answer": return renderOpenAnswer(it);
      default: return <p className="text-muted-foreground text-sm">Nepodporovaný typ úlohy.</p>;
    }
  };

  // ── Layout ──

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">{spec.header.title}</h2>
            {spec.header.subtitle && (
              <p className="text-sm text-muted-foreground">{spec.header.subtitle}</p>
            )}
          </div>
          {spec.header.variantLabel && (
            <Badge variant="outline" className="text-xs font-semibold">
              {spec.header.variantLabel}
            </Badge>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <Progress value={progressPct} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {answeredCount}/{totalItems}
          </span>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {lastSavedAt && !isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="h-3 w-3" />
            </span>
          )}
        </div>

        {/* Meta tags */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {spec.header.subject}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {spec.metadata.totalPoints} bodů
          </Badge>
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{spec.metadata.totalTimeMin} min
          </Badge>
        </div>
      </div>

      {/* Instructions */}
      {spec.header.instructions && !submitted && (
        <Card className="border-border bg-muted/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {spec.header.instructions}
          </CardContent>
        </Card>
      )}

      {/* Current Item */}
      {item && (
        <Card className={`border ${itemResult ? (itemResult.correct ? "border-green-500" : "border-red-300") : "border-border"}`}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">{item.itemNumber}.</span>
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[item.type] ?? item.type}
                </Badge>
                {spec.renderConfig.showDifficulty && (
                  <Badge className={`text-xs ${DIFFICULTY_COLORS[item.difficulty] ?? ""}`}>
                    {item.difficulty}
                  </Badge>
                )}
              </div>
              {spec.renderConfig.showPoints && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  [{item.points} {item.points === 1 ? "bod" : item.points < 5 ? "body" : "bodů"}]
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-foreground">{item.prompt}</p>

            {renderItemBody(item)}

            {/* Result feedback */}
            {showResults && itemResult && (
              <div className={`text-sm p-3 rounded-lg ${itemResult.correct ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {itemResult.correct ? (
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Správně (+{itemResult.points} b.)</span>
                ) : (
                  <span>Špatně — správná odpověď: <strong>{String(answerKey.find((k) => k.itemId === item.id)?.correctAnswer ?? "")}</strong></span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(currentIndex - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("student.buttons.previousItem")}
        </Button>

        <div className="flex gap-1 overflow-x-auto max-w-[200px]">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                i === currentIndex
                  ? "bg-primary text-primary-foreground"
                  : answers[it.id] !== undefined && answers[it.id] !== "" && answers[it.id] !== null
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {it.itemNumber}
            </button>
          ))}
        </div>

        {currentIndex < totalItems - 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            {t("student.buttons.nextItem")} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={submitted}
            onClick={handleSubmit}
          >
            <Send className="h-4 w-4 mr-1" /> Odevzdat
          </Button>
        )}
      </div>

      {/* Results summary */}
      {submitted && results && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-lg font-bold text-foreground">
              {results.score} / {results.maxScore} bodů
            </p>
            <p className="text-sm text-muted-foreground">
              {Math.round((results.score / Math.max(results.maxScore, 1)) * 100)} %
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual save */}
      {!submitted && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={handleSaveNow}>
            <Save className="h-4 w-4 mr-1" /> Uložit nyní
          </Button>
        </div>
      )}
    </div>
  );
}
