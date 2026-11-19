import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const TYNA = "tyna-id";
const rows: Record<string, any[]> = {
  classes: [
    { id: "normal", name: "Běžná třída", description: "", school: "Základní škola", schools: { is_demo: false }, field_of_study: "", year: 1, archived: false, created_at: "2026-01-01", created_by: "někdo-jiný", access_code: null, access_code_active: false },
    { id: "unused", name: "Nepoužívaná demo třída", description: "", school: "Demo škola Bezli", schools: { is_demo: true }, field_of_study: "", year: 1, archived: false, created_at: "2026-01-02", created_by: "demo-učitel", access_code: null, access_code_active: false },
    { id: "taught", name: "Týnina vyučovaná demo třída", description: "", school: "Demo škola Bezli", schools: { is_demo: true }, field_of_study: "", year: 1, archived: false, created_at: "2026-01-03", created_by: "demo-učitel", access_code: null, access_code_active: false },
    { id: "owned", name: "Týnina vlastní demo třída", description: "", school: "Demo škola Bezli", schools: { is_demo: true }, field_of_study: "", year: 1, archived: false, created_at: "2026-01-04", created_by: TYNA, access_code: null, access_code_active: false },
  ],
  class_members: [],
  profiles: [],
  class_teachers: [{ class_id: "taught", user_id: TYNA, role: "teacher" }],
  class_schedule_slots: [],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const query: any = {};
      ["select", "order", "eq", "in"].forEach((method) => { query[method] = vi.fn(() => query); });
      query.then = (resolve: any) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      return query;
    }),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: TYNA } }) }));
vi.mock("@/hooks/useMySchool", () => ({ useMySchool: () => ({ schoolId: null, schoolName: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import ClassesManager from "@/components/admin/ClassesManager";

describe("přepínač demo tříd ve správci tříd", () => {
  beforeEach(() => sessionStorage.clear());

  it("ve výchozím stavu skryje jen nepoužívanou demo třídu a přepínač ji odkryje", async () => {
    render(<MemoryRouter><ClassesManager /></MemoryRouter>);

    expect(await screen.findByText("Běžná třída")).toBeInTheDocument();
    expect(screen.getByText("Týnina vyučovaná demo třída")).toBeInTheDocument();
    expect(screen.getByText("Týnina vlastní demo třída")).toBeInTheDocument();
    expect(screen.queryByText("Nepoužívaná demo třída")).not.toBeInTheDocument();
    expect(screen.getByText("1 demo třída skryta")).toBeInTheDocument();
    expect(screen.getByText("Aktivní třídy: 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Zobrazit i demo třídy" }));

    expect(await screen.findByText("Nepoužívaná demo třída")).toBeInTheDocument();
    expect(screen.getByText("Aktivní třídy: 4")).toBeInTheDocument();
    expect(sessionStorage.getItem("classes-manager-show-demo")).toBe("true");
  });
});
