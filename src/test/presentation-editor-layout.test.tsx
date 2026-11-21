import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PresentationLeftPanel from "@/components/presentation/editor/PresentationLeftPanel";
import PresentationTopBar from "@/components/presentation/editor/PresentationTopBar";
import PresentationThumbnails from "@/components/presentation/editor/PresentationThumbnails";
import SelectionPropertiesPanel from "@/components/presentation/editor/SelectionPropertiesPanel";
import type { Block } from "@/lib/textbook-config";

const slide = { slideId: "s1", projector: { headline: "Voda", body: "" }, blocks: [] };

describe("Etapa 2 – rozvržení editoru", () => {
  it("levý panel nabízí přesně čtyři záložky a přepíná jejich obsah", () => {
    const onChange = vi.fn();
    render(<PresentationLeftPanel active="elements" onChange={onChange} open onToggle={vi.fn()}><p>Obsah prvků</p></PresentationLeftPanel>);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Prvky" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Z lekce" }));
    expect(onChange).toHaveBeenCalledWith("lesson");
    expect(screen.getByText("Obsah prvků")).toBeTruthy();
  });

  it("horní lišta zobrazí stav a propojení a spustí uložení i prezentaci", () => {
    const onSave = vi.fn();
    const onLaunch = vi.fn();
    render(<PresentationTopBar title="Voda" linkedLessonTitle="Voda kolem nás" dirty canSave onBack={vi.fn()} onImport={vi.fn()} onExport={vi.fn()} onAssign={vi.fn()} onSave={onSave} onLaunch={onLaunch} />);
    expect(screen.getByText("Neuloženo")).toBeTruthy();
    expect(screen.getByText("Propojeno s lekcí: Voda kolem nás")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    fireEvent.click(screen.getByRole("button", { name: "Spustit prezentaci" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onLaunch).toHaveBeenCalledOnce();
  });

  it("bez výběru ukazuje vlastnosti slidu, po výběru textu jeho formátování", () => {
    const base = { slide, themeId: "minimal", onThemeChange: vi.fn(), onSlideChange: vi.fn(), onBlockChange: vi.fn() };
    const { rerender } = render(<SelectionPropertiesPanel {...base} block={null} />);
    expect(screen.getByRole("heading", { name: "Slide" })).toBeTruthy();
    expect(screen.getByLabelText("Poznámky řečníka")).toBeTruthy();
    const block = { id: "t1", type: "paragraph", visible: true, props: { text: "Text" } } as Block;
    rerender(<SelectionPropertiesPanel {...base} block={block} />);
    expect(screen.getByRole("heading", { name: "Text", level: 2 })).toBeTruthy();
    expect(screen.getByLabelText("Písmo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tučně" })).toBeTruthy();
    expect(screen.getByLabelText("Zamknout úpravy")).toBeTruthy();
  });

  it("miniatury označí aktivitu a nad 30 slidů vykreslí jen okno", () => {
    const slides = Array.from({ length: 35 }, (_, index) => ({ ...slide, slideId: `s${index}`, projector: { headline: `Slide ${index + 1}` }, ...(index === 0 ? { type: "activity", activitySpec: { activityType: "mcq" } } : {}) }));
    const { container } = render(<PresentationThumbnails slides={slides} activeIndex={0} themeId="minimal" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.getByText("Aktivita")).toBeTruthy();
    expect(container.querySelectorAll("[data-testid^='slide-thumbnail-']").length).toBeLessThan(30);
    expect(screen.getByRole("button", { name: "Přidat slide" })).toBeTruthy();
  });
});
