import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/media/MediaPickerDialog", () => ({ MediaPickerDialog: ({ trigger }: any) => trigger }));

import WorksheetImageField from "@/components/worksheet/WorksheetImageField";
import LessonVisualBlockItem from "@/components/worksheet-items/LessonVisualBlockItem";

describe("editor image slot", () => {
  it("compact placeholder shows prompt and buttons without URL field", () => {
    render(<WorksheetImageField compact onChange={() => undefined} />);
    expect(screen.getByText("Klikněte a vložte obrázek")).toBeTruthy();
    expect(screen.getByText("Nahrát z počítače")).toBeTruthy();
    expect(screen.getByText("Knihovna / fotky")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/adresu https/)).toBeNull();
  });

  it("student/print renderer still shows nothing for empty image", () => {
    const { container } = render(
      <LessonVisualBlockItem item={{ id: "x", type: "image", imageUrl: "" } as any} value={undefined} onChange={() => undefined} disabled showResults={false} />,
    );
    expect(container.textContent).toBe("");
    expect(container.querySelector("[data-editor-image-slot]")).toBeNull();
  });
});
