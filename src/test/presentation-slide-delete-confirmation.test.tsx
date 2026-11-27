import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PresentationEditorDialog from "@/components/admin/PresentationEditorDialog";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/admin/BlockEditor", () => ({ SingleBlockEditor: () => null }));
vi.mock("@/components/admin/SlideCanvas", () => ({ default: () => null, SlideBody: () => null, STAGE_W: 1600, STAGE_H: 900, SLIDE_LAYOUTS: [] }));
vi.mock("@/components/admin/ImportPptxToPresentationDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/PresentationExportDialog", () => ({ default: () => null }));
vi.mock("@/lib/presentation-pdf-export", () => ({ exportSlidesToPdf: vi.fn() }));
vi.mock("@/components/game/AddSlideSheet", () => ({ AddSlideSheet: () => null }));
vi.mock("@/components/presentation/MyLessonActivitiesList", () => ({ default: () => null }));
vi.mock("@/components/presentation/InsertSlidesDialog", () => ({ default: () => null }));
vi.mock("@/components/presentation/InsertActivityDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/AiBlockTextButton", () => ({ default: () => null }));

afterEach(() => { cleanup(); localStorage.clear(); });

const initial = ["a", "b", "c"].map((slideId) => ({ slideId, projector: { headline: slideId, body: "" }, blocks: [] }));

function Editor() {
  const [slides, setSlides] = useState(initial);
  const [activeIndex, setActiveIndex] = useState(0);
  return <MemoryRouter><PresentationEditorDialog presentationLesson={{ id: "test", title: "[TEST] Potvrzení" }} source={{ type: "standalone", presentationId: "test" }} pendingSlides={slides} setPendingSlides={setSlides} editingSlideIndex={activeIndex} setEditingSlideIndex={setActiveIndex} onClose={vi.fn()} onLaunch={vi.fn()} existingSession={null} onContinueExisting={vi.fn()} onLaunchNew={vi.fn()} onCloseExisting={vi.fn()} /></MemoryRouter>;
}

describe("potvrzení mazání slidů", () => {
  it.each(["Delete", "Backspace", "menu", "context"])("%s neodebere slide před potvrzením; Zrušit nic nezmění", async (entry) => {
    render(<Editor />);
    const thumbnail = screen.getByRole("button", { name: /Otevřít slide 1:/ });
    if (entry === "Delete" || entry === "Backspace") fireEvent.keyDown(thumbnail, { key: entry });
    else {
      if (entry === "context") fireEvent.contextMenu(thumbnail);
      else fireEvent.keyDown(screen.getByRole("button", { name: "Další akce slidu 1" }), { key: "ArrowDown" });
      fireEvent.click(await screen.findByRole("menuitem", { name: "Smazat slide" }));
    }
    await screen.findByRole("alertdialog");
    expect(screen.getAllByRole("button", { name: /Otevřít slide/, hidden: true })).toHaveLength(3);
    await waitFor(() => expect(screen.getByRole("button", { name: "Zrušit" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getAllByRole("button", { name: /Otevřít slide/ })).toHaveLength(3);
  });

  it("potvrzené smazání vrátí Zpět včetně stejného slidu; Znovu smazání zopakuje", async () => {
    render(<Editor />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Otevřít slide 1:/ }), { key: "Delete" });
    fireEvent.click(await screen.findByRole("button", { name: "Smazat" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Otevřít slide/ })).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Otevřít slide 1: a" })).toBeNull();
    const toolbar = document.querySelector<HTMLElement>("[data-slide-toolbar]");
    if (!toolbar) throw new Error("Chybí lišta editoru");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Zpět" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Otevřít slide/ })).toHaveLength(3));
    expect(screen.getByRole("button", { name: "Otevřít slide 1: a" })).toBeTruthy();
    fireEvent.click(within(toolbar).getByRole("button", { name: "Znovu" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Otevřít slide/ })).toHaveLength(2));
  });

  it("mazání z lišty při skrytých miniaturách také vyžaduje potvrzení", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Skrýt miniatury (Alt+M)" }));
    fireEvent.click(screen.getByRole("button", { name: "Smazat aktuální slide" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit miniatury (Alt+M)" }));
    expect(screen.getAllByRole("button", { name: /Otevřít slide/ })).toHaveLength(3);
  });

  it("mazání dvou vybraných slidů také čeká na potvrzení", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: /Otevřít slide 2:/ }), { shiftKey: true });
    fireEvent.keyDown(screen.getByRole("button", { name: /Otevřít slide 2:/ }), { key: "Delete" });
    await screen.findByRole("alertdialog");
    expect(screen.getAllByRole("button", { name: /Otevřít slide/, hidden: true })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Smazat" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Otevřít slide/ })).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Otevřít slide 1: c" })).toBeTruthy();
  });
});