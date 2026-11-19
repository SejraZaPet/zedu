import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: any[]) => invoke(...a) }, auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } },
}));
vi.mock("@/lib/source-extract", () => ({ extractFileSource: vi.fn(), extractUrlSource: vi.fn() }));
vi.mock("@/lib/worksheet-images", () => ({ uploadWorksheetImage: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import FromSourceActivityPanel from "@/components/studio/FromSourceActivityPanel";

describe("Aktivita z vlastního materiálu", () => {
  it("text → AI návrh → odškrtnutí → vloží jen vybrané kroky", async () => {
    invoke.mockResolvedValue({ data: { steps: [
      { type: "mcq", question: "Otázka A", options: ["1", "2"], correctIndex: 1 },
      { type: "open", question: "Otázka B" },
    ] }, error: null });
    const onInsert = vi.fn();
    render(<FromSourceActivityPanel onInsert={onInsert} />);
    fireEvent.click(screen.getByRole("button", { name: "Vložit text" }));
    fireEvent.change(screen.getByLabelText(/Text z prezentace/), { target: { value: "Fotosyntéza ".repeat(20) } });
    fireEvent.click(screen.getByRole("button", { name: "Přidat text" }));
    const gen = screen.getByRole("button", { name: /Navrhnout sadu/ });
    await waitFor(() => expect(gen).not.toBeDisabled());
    fireEvent.click(gen);
    await screen.findByLabelText("Návrh sady");
    expect(invoke).toHaveBeenCalledWith("generate-activity-from-text", { body: expect.objectContaining({ types: ["mcq", "true_false"], count: 6 }) });
    expect(onInsert).not.toHaveBeenCalled(); // nic se nevloží bez potvrzení
    fireEvent.click(screen.getByLabelText("Vložit krok 2"));
    fireEvent.click(screen.getByRole("button", { name: "Vložit 1 krok" }));
    expect(onInsert).toHaveBeenCalledTimes(1);
    const slides = onInsert.mock.calls[0][0];
    expect(slides).toHaveLength(1);
    expect(slides[0].activitySpec.correctIndex).toBe(1);
  });
});
