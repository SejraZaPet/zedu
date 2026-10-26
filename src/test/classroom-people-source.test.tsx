import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const state = { loading: true };
vi.mock("@/hooks/useTeacherClasses", () => ({ useTeacherClasses: () => ({ myClasses: state.loading ? [] : [{ id: "c1", name: "[TEST] 7.A" }], loading: state.loading }) }));
vi.mock("@/hooks/useSubjectGroups", () => ({ useSubjectGroups: () => ({ groups: [], loading: state.loading }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }), in: async () => ({ data: [], error: null }) }) }) } }));

import { PeopleTool } from "@/components/classroom/PeopleTools";

describe("výběr třídy v losování", () => {
  beforeEach(() => { state.loading = true; localStorage.clear(); });
  it("během načítání ukáže „Načítám třídy…“", () => {
    render(<PeopleTool />);
    expect(screen.getAllByText(/Načítám třídy/).length).toBeGreaterThan(0);
  });
  it("po načtení předvybere třídu z plánu s popiskem", () => {
    const { rerender } = render(<PeopleTool initialTarget={{ classId: "c1" }} />);
    state.loading = false;
    rerender(<PeopleTool initialTarget={{ classId: "c1" }} />);
    expect(screen.getByText("Předvybráno z plánu hodiny.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Třída nebo skupina" }).textContent).toContain("[TEST] 7.A");
  });
  it("bez plánu zůstane vlastní seznam a nepřepne se", () => {
    const { rerender } = render(<PeopleTool />);
    state.loading = false;
    rerender(<PeopleTool />);
    expect(screen.queryByText("Předvybráno z plánu hodiny.")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Třída nebo skupina" }).textContent).toContain("Vlastní seznam");
  });
});
