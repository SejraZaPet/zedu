import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";

const rows = [
  { id: "w1", title: "List A", status: "published", scheduled_publish_at: null, subject: "Dějepis", subject_id: "s1", created_at: "2026-10-01" },
  { id: "w2", title: "List B", status: "draft", scheduled_publish_at: null, subject: "Dějepis", subject_id: "s1", created_at: "2026-10-02" },
];
vi.mock("@/integrations/supabase/client", () => {
  const b: any = { select: () => b, eq: () => b, order: () => Promise.resolve({ data: rows, error: null }) };
  return { supabase: { from: () => b } };
});
vi.mock("@/components/worksheet/PublishWorksheetDialog", () => ({ default: () => null }));

import PlanWorksheetsSection from "@/components/lesson-plan/PlanWorksheetsSection";
import { addIds, moveId, parsePlanWorksheetIds, removeId, filterWorksheetOptions } from "@/lib/plan-worksheets";

describe("pracovní listy k hodině", () => {
  it("výběr, pořadí a odebrání; načtení zpět", () => {
    let ids = addIds([], ["w1", "w2"]);
    ids = moveId(ids, "w2", -1);
    expect(ids).toEqual(["w2", "w1"]);
    expect(parsePlanWorksheetIds(ids)).toEqual(["w2", "w1"]);
    expect(parsePlanWorksheetIds(null)).toEqual([]);
    expect(removeId(ids, "w2")).toEqual(["w1"]);
  });

  it("nabídka: nejnovější první a filtr předmětu", () => {
    const list = filterWorksheetOptions([...rows, { ...rows[0], id: "w3", subject_id: "s2", created_at: "2026-10-03" }], { subjectId: "s1", onlySubject: true });
    expect(list.map((w) => w.id)).toEqual(["w2", "w1"]);
  });

  it("editor ukládá i načítá worksheet_ids", () => {
    const src = readFileSync("src/pages/TeacherLessonPlanEditor.tsx", "utf8");
    expect(src).toMatch(/worksheet_ids: worksheetIds/);
    expect(src).toMatch(/setWorksheetIds\(parsePlanWorksheetIds\(\(data as any\)\.worksheet_ids\)\)/);
  });

  it("koncept zobrazí upozornění, odebrání list smaže", async () => {
    const Host = () => {
      const [v, setV] = useState(["w1", "w2"]);
      return <PlanWorksheetsSection teacherId="t" value={v} onChange={setV} subjectId="s1" />;
    };
    render(<Host />);
    expect(await screen.findByText("Žáci ho neuvidí, dokud ho nepublikuješ")).toBeTruthy();
    expect(screen.getAllByText("Žáci ho neuvidí, dokud ho nepublikuješ")).toHaveLength(1);
    fireEvent.click(screen.getAllByText("Odebrat")[1]);
    expect(screen.queryByText("List B")).toBeNull();
    expect(screen.getAllByTestId("plan-worksheet")).toHaveLength(1);
  });
});
