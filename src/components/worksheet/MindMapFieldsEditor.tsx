/**
 * Úprava úlohy „Doplň myšlenkovou mapu“ v editoru listu.
 * Mapu posílá jako patch položky a správné odpovědi jako patch klíče
 * (nikdy je neukládá do mapy, aby se nedostaly do žákovské verze).
 */
import type { AnswerKeyEntry, WorksheetItem } from "@/lib/worksheet-spec";
import { keyToMap, mapToKey, normalizeMindMap } from "@/lib/mind-map";
import MindMapEditor from "@/components/mind-map/MindMapEditor";

export default function MindMapFieldsEditor({
  item,
  answerKey,
  onUpdateItem,
  onUpdateKey,
}: {
  item: WorksheetItem;
  answerKey: AnswerKeyEntry | null;
  onUpdateItem: (p: Partial<WorksheetItem>) => void;
  onUpdateKey: (p: Partial<AnswerKeyEntry>) => void;
}) {
  if (item.type !== "mind_map") return null;
  const data = normalizeMindMap(item.mindMap);
  const answerMap = keyToMap(data, answerKey?.correctAnswer);
  return (
    <MindMapEditor
      data={data}
      withBlanks
      answerMap={answerMap}
      onChange={(next, map) => {
        const clean = normalizeMindMap(next);
        onUpdateItem({ mindMap: clean });
        onUpdateKey({ correctAnswer: mapToKey(clean, map) });
      }}
    />
  );
}
