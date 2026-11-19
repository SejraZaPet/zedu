import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fx = vi.hoisted(() => {
  const CLASS_ID = "c1111111-1111-1111-1111-111111111111";
  const STUDENT_ID = "s2222222-2222-2222-2222-222222222222";
  const rows: Record<string, any[]> = {
    classes: [
      {
        id: CLASS_ID, name: "Kuchař 1.A", description: "", school: "Základní škola",
        field_of_study: "Kuchař", year: 1, archived: false, created_at: "2026-01-01T00:00:00Z",
        access_code: null, access_code_active: false,
      },
    ],
    class_members: [{ class_id: CLASS_ID, user_id: STUDENT_ID }],
    profiles: [
      {
        id: STUDENT_ID, first_name: "Jan", last_name: "Novák", email: "jan.novak@example.test",
        school: "Základní škola", field_of_study: "Kuchař", year: 1, status: "approved",
      },
    ],
    class_teachers: [],
    class_schedule_slots: [],
  };
  const makeQuery = (table: string): any => {
    const q: any = {};
    ["select", "order", "eq", "in", "is", "neq", "gte", "lte", "limit", "update", "insert", "delete"]
      .forEach((m) => { q[m] = vi.fn(() => q); });
    q.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    q.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    q.then = (onF: any, onR?: any) =>
      Promise.resolve({ data: rows[table] ?? [], error: null }).then(onF, onR);
    return q;
  };
  return { CLASS_ID, STUDENT_ID, makeQuery };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn((table: string) => fx.makeQuery(table)) },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher-1" } }) }));
vi.mock("@/hooks/useMySchool", () => ({ useMySchool: () => ({ schoolId: null, schoolName: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import ClassesManager from "@/components/admin/ClassesManager";
import ClassMembersDialog from "@/components/admin/ClassMembersDialog";

describe("seznam tříd – otevření třídy", () => {
  it("tlačítko Otevřít míří na detail třídy s jejím id", async () => {
    render(<MemoryRouter><ClassesManager /></MemoryRouter>);
    const open = await screen.findByRole("link", { name: /Otevřít/ });
    expect(open).toHaveAttribute("href", `/ucitel/tridy/${fx.CLASS_ID}`);
  });

  it("název třídy je odkaz na stejnou adresu", async () => {
    render(<MemoryRouter><ClassesManager /></MemoryRouter>);
    const name = await screen.findByRole("link", { name: "Kuchař 1.A" });
    expect(name).toHaveAttribute("href", `/ucitel/tridy/${fx.CLASS_ID}`);
  });
});

describe("dialog Studenti – portfolio žáka", () => {
  it("každý žák má tlačítko Portfolio s jeho id", async () => {
    render(
      <MemoryRouter>
        <ClassMembersDialog
          classItem={{ id: fx.CLASS_ID, name: "Kuchař 1.A" }}
          open
          onOpenChange={vi.fn()}
          onUpdated={vi.fn()}
        />
      </MemoryRouter>,
    );
    const link = await screen.findByRole("link", { name: /Portfolio/ });
    expect(link).toHaveAttribute("href", `/portfolio/${fx.STUDENT_ID}`);
  });
});
