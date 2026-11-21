import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorksheetAttemptGrading from "./WorksheetAttemptGrading";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/grading-feedback", () => ({ requestWorksheetPoints: mocks.request }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: { spec: {
          title: "Otevřené odpovědi",
          variants: [{ variantId: "A", items: [{ id: "q1", type: "open_answer", prompt: "Vysvětli jev", points: 2 }] }],
          answerKeys: { A: [{ itemId: "q1", correctAnswer: "Otevřená odpověď", rubric: "2 b za úplné vysvětlení" }] },
        } }, error: null }),
      };
      return chain;
    },
  },
}));

describe("AI návrh bodů pracovního listu", () => {
  beforeEach(() => {
    mocks.request.mockResolvedValue([{ id: "q1", points: 1.5, reason: "Vysvětlení je částečné." }]);
  });
  afterEach(cleanup);

  it("předvyplní body a zdůvodnění, ale bez Uložit nic neodešle", async () => {
    const onSave = vi.fn();
    render(<WorksheetAttemptGrading
      worksheetId="w1"
      answers={{ q1: "Částečná odpověď" }}
      existing={null}
      saving={false}
      onSave={onSave}
    />);

    fireEvent.click(await screen.findByRole("button", { name: "Navrhnout body pomocí AI" }));
    await waitFor(() => expect(screen.getByLabelText("Body za položku 1")).toHaveValue(1.5));
    expect(screen.getByLabelText("Komentář k položce 1")).toHaveValue("Vysvětlení je částečné.");
    expect(mocks.request).toHaveBeenCalledWith("Otevřené odpovědi", [{
      id: "q1",
      prompt: "Vysvětli jev",
      answer: "Částečná odpověď",
      max: 2,
      rubric: "2 b za úplné vysvětlení",
    }]);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Uložit hodnocení" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
