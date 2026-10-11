import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AssignmentFormActions from "@/components/assignments/AssignmentFormActions";
import { showSaveChangesOnly, editSaveOutcome } from "@/lib/assignment-edit-save";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
});

const baseProps = {
  creating: false,
  canSchedule: false,
  onSaveDraft: vi.fn(),
  onSchedule: vi.fn(),
  onPublish: vi.fn(),
  onCancel: vi.fn(),
};

describe("AssignmentFormActions – tlačítka úkolu", () => {
  it("u publikované úlohy zobrazí jen „Uložit změny“ a poznámku, bez konceptu i publikování", () => {
    render(<AssignmentFormActions {...baseProps} isEditingPublished />);
    expect(screen.getByRole("button", { name: "Uložit změny" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Uložit koncept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publikovat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Naplánovat" })).toBeNull();
    expect(screen.getByText("Úkol je publikovaný, změny se projeví žákům hned po uložení.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));
    expect(baseProps.onPublish).toHaveBeenCalledTimes(1);
  });

  it("u konceptu zůstávají tři původní tlačítka", () => {
    render(<AssignmentFormActions {...baseProps} isEditingPublished={false} />);
    expect(screen.getByRole("button", { name: "Uložit koncept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Naplánovat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publikovat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Uložit změny" })).toBeNull();
  });
});

describe("editSaveOutcome – logika ukládání", () => {
  it("u publikované úlohy nezmění status a ohlásí „Změny uloženy“", () => {
    const out = editSaveOutcome("published", "published");
    expect(out.status).toBeUndefined();
    expect(out.toastTitle).toBe("Změny uloženy");
    expect(showSaveChangesOnly("published")).toBe(true);
  });

  it("u konceptu publikováním nastaví status published a původní titulek", () => {
    expect(editSaveOutcome("draft", "published")).toEqual({ status: "published", toastTitle: "Úloha publikována" });
    expect(showSaveChangesOnly("draft")).toBe(false);
  });

  it("koncept se ukládá jako draft", () => {
    expect(editSaveOutcome("published", "draft").status).toBe("draft");
  });
});
