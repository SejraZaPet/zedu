import type { WorksheetItemProps } from "./types";
import MindMapView from "@/components/mind-map/MindMapView";
import { normalizeMindMap, scoreMindMap } from "@/lib/mind-map";

/** Pracovní list: žák doplňuje prázdné uzly myšlenkové mapy. */
export default function MindMapItem({ item, value, onChange, disabled, showResults, answerKeyEntry }: WorksheetItemProps) {
  const data = normalizeMindMap(item.mindMap);
  const answers = Array.isArray(value) ? value.map((v) => String(v ?? "")) : [];
  const results =
    showResults && answerKeyEntry
      ? scoreMindMap(answers, answerKeyEntry.correctAnswer, item.points).perBlank
      : undefined;
  return (
    <MindMapView
      data={data}
      mode="fill"
      answers={answers}
      onAnswerChange={(next) => onChange(next)}
      disabled={disabled}
      results={results}
    />
  );
}
