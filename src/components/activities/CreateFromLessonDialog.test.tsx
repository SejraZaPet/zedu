import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import CreateFromLessonDialog from "./CreateFromLessonDialog";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher" } }) }));
vi.mock("@/components/ui/searchable-select", () => ({ SearchableSelect: ({ label, options, value, onValueChange }: any) => <select aria-label={label} value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
vi.mock("@/components/admin/block-editors/ActivityBlock", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke },
  from: (table: string) => {
    const book = { id: "book", teacher_id: "teacher", copied_from_textbook_id: null, is_system: false, is_demo_seed: false, deleted_at: null };
    const data = table === "teacher_textbooks" ? [book] : [{ id: "lesson", title: "[TEST] Vlastní lekce", textbook_id: "book", blocks: [{ type: "text", props: { text: "[TEST] Dostatečně dlouhý text vlastní lekce pro návrh pěti otázek do kvízu ABCD." } }] }];
    const chain: any = { select: () => chain, eq: () => chain, is: () => chain, in: () => chain, order: () => chain, maybeSingle: () => Promise.resolve({ data: book, error: null }), then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
    return chain;
  },
} }));
describe("Vytvořit z lekce – lokální kontrola", () => {
  beforeEach(() => { vi.stubGlobal("crypto", webcrypto); invoke.mockReset(); });
  async function selectSource() {
    await screen.findByRole("option", { name: "[TEST] Vlastní lekce" });
    fireEvent.change(screen.getByLabelText("Vybrat vlastní lekci"), { target: { value: "lesson" } });
    fireEvent.click(screen.getByRole("checkbox"));
  }
  it("chyba AI nic nevloží a zachová zdroj", async () => {
    invoke.mockResolvedValue({ data: { error: "[TEST] Chyba návrhu" }, error: null });
    const onInsert = vi.fn();
    render(<CreateFromLessonDialog open onOpenChange={vi.fn()} onInsert={onInsert} />);
    await selectSource();
    fireEvent.click(screen.getByRole("button", { name: "Navrhnout" }));
    await screen.findByRole("alert");
    expect(onInsert).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Vybrat vlastní lekci")).toHaveValue("lesson");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
  it("návrh se vloží až po výslovné kontrole učitelem", async () => {
    invoke.mockResolvedValue({ data: { questions: [{ question: "[TEST] Otázka", answers: ["A", "B", "C", "D"], correctIndex: 0 }] }, error: null });
    const onInsert = vi.fn();
    render(<CreateFromLessonDialog open onOpenChange={vi.fn()} onInsert={onInsert} />);
    await selectSource();
    fireEvent.click(screen.getByRole("button", { name: "Navrhnout" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Vložit" })).toBeDisabled());
    expect(onInsert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Vložit" }));
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][0].props).toMatchObject({ ai_generated: true, source: { lessonId: "lesson", lessonSource: "teacher_textbook_lessons", sectionIds: ["1"] } });
  });
});