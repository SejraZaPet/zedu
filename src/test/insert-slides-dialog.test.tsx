import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InsertSlidesDialog from "@/components/presentation/InsertSlidesDialog";

const presentation = { id: "other", title: "Zdrojová prezentace", slides: [
  { slideId: "one", projector: { headline: "První" }, teacherNotes: "Poznámka", backgroundOverride: { color: "#fff" }, blocks: [{ id: "block", type: "image", props: { url: "https://img.test/a.png" } }], activitySpec: { activityType: "mcq", options: [{ text: "A", correct: true }] } },
  { slideId: "two", projector: { headline: "Druhý" }, blocks: [] },
] };

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }) },
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [presentation], error: null }) }) }) }),
} }));
vi.mock("@/lib/teacher-lesson-catalog", () => ({ loadTeacherLessonOptions: async () => [] }));

describe("výběr více slidů", () => {
  it("vloží vybrané slidy na zvolené místo jako úplné nezávislé kopie", async () => {
    const onInsert = vi.fn();
    render(<InsertSlidesDialog open onOpenChange={vi.fn()} onInsert={onInsert} currentPresentationId="current" themeId="minimal" />);
    await screen.findByRole("button", { name: /Zdrojová prezentace/ });
    fireEvent.click(screen.getByRole("button", { name: "Vybrat všechny" }));
    fireEvent.click(screen.getByLabelText("Na konec"));
    fireEvent.click(screen.getByRole("button", { name: "Vložit 2 slidy" }));
    await waitFor(() => expect(onInsert).toHaveBeenCalledOnce());
    const [slides, position] = onInsert.mock.calls[0];
    expect(position).toBe("end");
    expect(slides).toHaveLength(2);
    expect(slides[0].teacherNotes).toBe("Poznámka");
    expect(slides[0].blocks[0].props.url).toBe("https://img.test/a.png");
    expect(slides[0].activitySpec).toEqual(presentation.slides[0].activitySpec);
    expect(slides[0].slideId).not.toBe("one");
    expect(slides[0].blocks[0].id).not.toBe("block");
  });
});
