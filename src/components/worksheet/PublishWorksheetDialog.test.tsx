import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PublishWorksheetDialog from "./PublishWorksheetDialog";
const mocks = vi.hoisted(() => ({ rows: [] as any[], updates: vi.fn(), inserts: vi.fn() }));
vi.mock("@/hooks/useTeacherClasses", () => ({ useTeacherClasses: () => ({ myClasses: [{ id: "class", name: "[TEST] Třída" }] }) }));
vi.mock("@/hooks/useSubjectGroups", () => ({ useSubjectGroups: () => ({ groups: [{ id: "group", name: "[TEST] Skupina", subject_id: "subject" }] }) }));
vi.mock("@/components/ui/searchable-select", () => ({ SearchableSelect: ({ label, options, value, onValueChange }: any) => <select aria-label={label} value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
vi.mock("@/components/ui/select", () => ({ Select: ({ children, onValueChange }: any) => <div>{children}<button onClick={() => onValueChange("group:group")}>[TEST] Vybrat skupinu</button></div>, SelectTrigger: ({ children }: any) => <div>{children}</div>, SelectValue: () => null, SelectContent: ({ children }: any) => <div>{children}</div>, SelectItem: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }), getSession: async () => ({ data: { session: { user: { id: "teacher" } } } }) },
  from: (table: string) => {
    let write = false;
    const result = () => ({ data: write ? { id: "a" } : mocks.rows, error: null });
    const chain: any = { select: () => chain, eq: () => chain, order: () => chain, update: (patch: any) => { write = true; mocks.updates(table, patch); return chain; }, insert: (patch: any) => { write = true; mocks.inserts(table, patch); return chain; }, maybeSingle: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve) };
    return chain;
  },
} }));
const row = { id: "a", title: "[TEST] Existující úkol", teacher_id: "teacher", subject_id: "subject", class_id: null, group_id: "group", worksheet_id: "ws", settings: {}, updated_at: "2026-01-01" };
describe("Zadat list žákům", () => {
  beforeEach(() => { mocks.rows = [row]; mocks.updates.mockClear(); mocks.inserts.mockClear(); });
  afterEach(cleanup);
  async function setup() {
    render(<MemoryRouter><PublishWorksheetDialog open onOpenChange={vi.fn()} worksheetId="ws" worksheetTitle="[TEST] List" subjectId="subject" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "[TEST] Vybrat skupinu" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publikovat", exact: true })).not.toBeDisabled());
  }
  it("před duplicitním vytvořením nic nezveřejní ani nezaloží", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Publikovat", exact: true }));
    await screen.findByRole("button", { name: "Přesto vytvořit nový" });
    expect(mocks.updates).not.toHaveBeenCalled();
    expect(mocks.inserts).not.toHaveBeenCalled();
  });
  it("přidání do existujícího úkolu změní pouze list, nepublikuje a nezakládá úlohu", async () => {
    mocks.rows = [{ ...row, worksheet_id: null }];
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Přidat do existujícího úkolu" }));
    fireEvent.change(screen.getByLabelText("Vybrat existující úkol nebo materiál"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Přidat list", exact: true }));
    await waitFor(() => expect(mocks.updates).toHaveBeenCalledWith("assignments", { worksheet_id: "ws" }));
    expect(mocks.updates).toHaveBeenCalledTimes(1);
    expect(mocks.inserts).not.toHaveBeenCalled();
  });
  it("jiný již přiložený list nahradí až po potvrzení", async () => {
    mocks.rows = [{ ...row, worksheet_id: "old" }];
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Přidat do existujícího úkolu" }));
    fireEvent.change(screen.getByLabelText("Vybrat existující úkol nebo materiál"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Přidat list", exact: true }));
    await screen.findByRole("button", { name: "Potvrdit nahrazení listu" });
    expect(mocks.updates).not.toHaveBeenCalled();
  });
});