import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PresentationLeftPanel from "@/components/presentation/editor/PresentationLeftPanel";
import PresentationTopBar from "@/components/presentation/editor/PresentationTopBar";
import PresentationThumbnails from "@/components/presentation/editor/PresentationThumbnails";
import SelectionPropertiesPanel from "@/components/presentation/editor/SelectionPropertiesPanel";
import type { Block } from "@/lib/textbook-config";

const slide = { slideId: "s1", projector: { headline: "Voda", body: "" }, blocks: [] };
const thumbnailActions = { onDelete: vi.fn(), onDuplicate: vi.fn(), onMoveEdge: vi.fn(), onToggleHidden: vi.fn(), onInsert: vi.fn(), onTransitionChange: vi.fn(), onApplyTransitionAll: vi.fn() };

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
    const { container } = render(<PresentationThumbnails slides={slides} activeIndex={0} themeId="minimal" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} {...thumbnailActions} />);
    expect(screen.getByText("Aktivita")).toBeTruthy();
    expect(container.querySelectorAll("[data-testid^='slide-thumbnail-']").length).toBeLessThan(30);
    expect(screen.getByRole("button", { name: "Přidat slide" })).toBeTruthy();
  });

  it("miniatura použije importované pozadí slidu, ne výchozí motiv", () => {
    const imported = { ...slide, backgroundOverride: { color: "#5D3D7F" } };
    render(<PresentationThumbnails slides={[imported]} activeIndex={0} themeId="nature" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} {...thumbnailActions} />);
    const thumbnail = screen.getByRole("button", { name: /Otevřít slide 1/ }) as HTMLButtonElement;
    expect(thumbnail.style.backgroundColor).toBe("rgb(93, 61, 127)");
  });

  it("miniatury předají hromadnou duplikaci, Delete a výběr kontextové nabídky", () => {
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onToggleHidden = vi.fn();
    const onSelect = vi.fn();
    const slides = [{ ...slide, slideId: "s1" }, { ...slide, slideId: "s2" }];
    render(<PresentationThumbnails slides={slides} activeIndex={0} selectedIndices={[0, 1]} themeId="minimal" onSelect={onSelect} onMove={vi.fn()} onAdd={vi.fn()} onDelete={onDelete} onDuplicate={onDuplicate} onMoveEdge={vi.fn()} onToggleHidden={onToggleHidden} onInsert={vi.fn()} onTransitionChange={vi.fn()} onApplyTransitionAll={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Duplikovat 2 slidy" })[0]);
    expect(onDuplicate).toHaveBeenCalledWith([0, 1]);
    fireEvent.keyDown(screen.getByRole("button", { name: /Otevřít slide 1/ }), { key: "Delete" });
    expect(onDelete).toHaveBeenCalledWith([0, 1]);
    fireEvent.contextMenu(screen.getByRole("button", { name: /Otevřít slide 2/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Skrýt při promítání" }));
    expect(onToggleHidden).toHaveBeenCalledWith([0, 1]);
  });

  it("kontext cizí miniatury ji nejprve vybere", () => {
    const onSelect = vi.fn();
    const slides = [{ ...slide, slideId: "s1" }, { ...slide, slideId: "s2" }];
    render(<PresentationThumbnails slides={slides} activeIndex={0} selectedIndices={[0]} themeId="minimal" onSelect={onSelect} onMove={vi.fn()} onAdd={vi.fn()} {...thumbnailActions} />);
    fireEvent.contextMenu(screen.getByRole("button", { name: /Otevřít slide 2/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("plus mezi miniatury vloží obsah přesně na pozici druhého slidu", () => {
    const onInsert = vi.fn();
    const slides = [{ ...slide, slideId: "s1" }, { ...slide, slideId: "s2" }];
    render(<PresentationThumbnails {...thumbnailActions} slides={slides} activeIndex={0} themeId="minimal" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} onInsert={onInsert} />);
    const insertTrigger = screen.getByRole("button", { name: "Vložit slide mezi 1 a 2" });
    fireEvent.pointerDown(insertTrigger);
    fireEvent.click(insertTrigger);
    for (const [item, kind] of [["Prázdný slide", "blank"], ["Ze šablony", "template"], ["Aktivita", "activity"], ["Z lekce nebo prezentace", "lesson"]] as const) {
      fireEvent.click(screen.getByRole("menuitem", { name: item }));
      expect(onInsert).toHaveBeenLastCalledWith(kind, 1);
      fireEvent.pointerDown(insertTrigger);
      fireEvent.click(insertTrigger);
    }
  });

  it("přechod mezi miniatury změní vstupní slide a použije stejné nastavení na všechny", () => {
    const onTransitionChange = vi.fn();
    const onApplyTransitionAll = vi.fn();
    const slides = [{ ...slide, slideId: "s1", transitionStyle: "cut" }, { ...slide, slideId: "s2", transitionStyle: "cut" }];
    render(<PresentationThumbnails {...thumbnailActions} slides={slides} activeIndex={0} themeId="minimal" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} onTransitionChange={onTransitionChange} onApplyTransitionAll={onApplyTransitionAll} />);
    fireEvent.click(screen.getByRole("button", { name: "Přechod mezi slidem 1 a 2: Bez přechodu" }));
    fireEvent.click(screen.getByRole("radio", { name: "Posun" }));
    expect(onTransitionChange).toHaveBeenLastCalledWith(1, { style: "push", direction: "left", duration: 0.45 });
    fireEvent.click(screen.getByRole("radio", { name: "Bez přechodu" }));
    expect(onTransitionChange).toHaveBeenLastCalledWith(1, { style: "cut", direction: "left", duration: 0.45 });
    fireEvent.click(screen.getByRole("radio", { name: "Posun" }));
    fireEvent.click(screen.getByRole("button", { name: "Použít na všechny přechody" }));
    expect(onApplyTransitionAll).toHaveBeenCalledWith({ style: "push", direction: "left", duration: 0.45 });
  });

  it("poslední slide má smazání zablokované", () => {
    render(<PresentationThumbnails slides={[slide]} activeIndex={0} themeId="minimal" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} {...thumbnailActions} />);
    expect(screen.getByRole("button", { name: "Smazat slide 1" })).toBeDisabled();
  });

  it("skryté miniatury ponechají číslo slidu, šipky a opětovné zobrazení", () => {
    const onNext = vi.fn();
    const onToggle = vi.fn();
    const slides = [{ ...slide, slideId: "s1" }, { ...slide, slideId: "s2" }];
    render(<PresentationThumbnails slides={slides} activeIndex={0} themeId="minimal" onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} {...thumbnailActions} open={false} onToggle={onToggle} onPrevious={vi.fn()} onNext={onNext} />);
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.queryByTestId("slide-thumbnail-0")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Další slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit miniatury (Alt+M)" }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
