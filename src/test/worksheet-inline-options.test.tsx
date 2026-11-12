import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MCQItem from "@/components/worksheet-items/MCQItem";
import LessonVisualBlockItem from "@/components/worksheet-items/LessonVisualBlockItem";
import LayoutBlockItem from "@/components/worksheet-items/LayoutBlockItem";
import { applyWorksheetInlineTextEdit } from "@/lib/worksheet-inline-edit";
import { createDefaultItem, emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import type { WorksheetItem } from "@/lib/worksheet-spec";

const props = { value: undefined, onChange: () => undefined, disabled: true, showResults: false } as const;

function commit(label: string, value: string) {
  const box = screen.getByLabelText(label);
  fireEvent.focus(box);
  fireEvent.change(box, { target: { value: "rozepsaný text" } });
  fireEvent.change(box, { target: { value } });
  fireEvent.blur(box);
}

describe("inline úpravy možností a jednoduchých bloků", () => {
  it("možnost ABCD zapíše jednou do choices.<index> a klik nepropaguje", () => {
    const edit = vi.fn();
    const click = vi.fn();
    const item = { ...createDefaultItem("mcq", 1), choices: ["Alfa", "Beta"] };
    render(<div onClick={click}><MCQItem {...props} item={item} onEditText={edit} /></div>);
    const box = screen.getByLabelText("Možnost B");
    fireEvent.click(box);
    expect(click).not.toHaveBeenCalled();
    commit("Možnost B", "Nová beta");
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledWith("choices.1", "Nová beta");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("bez onEditText zůstanou možnosti statické jako u žáka", () => {
    const item = { ...createDefaultItem("mcq", 1), choices: ["Alfa", "Beta"] };
    const { container } = render(<MCQItem {...props} item={item} />);
    expect(container.querySelector("textarea")).toBeNull();
    expect(screen.getByText("Alfa")).toBeInTheDocument();
  });

  it("text vedle obrázku a oba texty rámečku zapisují do polí formuláře", () => {
    const edit = vi.fn();
    const imageText = { ...createDefaultItem("image_text", 1), imageText: "<p>Starý <strong>text</strong></p>" };
    const { rerender } = render(<LessonVisualBlockItem {...props} item={imageText} onEditText={edit} />);
    expect(screen.getByLabelText("Text vedle obrázku")).toHaveValue("Starý text");
    commit("Text vedle obrázku", "Nový prostý text");
    expect(edit).toHaveBeenLastCalledWith("imageText", "Nový prostý text");

    const callout = { ...createDefaultItem("callout", 2), calloutTitle: "Pozor", calloutText: "Původní" };
    rerender(<LessonVisualBlockItem {...props} item={callout} onEditText={edit} />);
    commit("Nadpis rámečku", "Důležité");
    commit("Text rámečku", "Nový pokyn");
    expect(edit).toHaveBeenCalledWith("calloutTitle", "Důležité");
    expect(edit).toHaveBeenCalledWith("calloutText", "Nový pokyn");
  });

  it("kroky postupu se mění po indexu bez přidávání nebo mazání", () => {
    const edit = vi.fn();
    const item = { ...createDefaultItem("flow_steps", 1), flowSteps: ["První", "Druhý"] };
    render(<LayoutBlockItem {...props} item={item} onEditText={edit} />);
    commit("Krok 2", "Upravený druhý");
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledWith("flowSteps.1", "Upravený druhý");
  });

  it("změna správné možnosti a jejího klíče je jedna atomická změna spec", () => {
    const item = { ...createDefaultItem("mcq", 1), id: "q1", points: 4, choices: ["Alfa", "Beta"] };
    const other = { ...createDefaultItem("short_answer", 2), id: "q2" };
    const spec = emptyWorksheetSpec();
    spec.variants[0].items = [item, other];
    spec.answerKeys.A = [
      { itemId: "q1", itemNumber: 1, correctAnswer: "Beta" },
      { itemId: "q2", itemNumber: 2, correctAnswer: "Odpověď" },
    ];
    const next = applyWorksheetInlineTextEdit(spec, "q1", "choices.1", "Nová beta");
    expect(next.variants[0].items[0]).toMatchObject({ choices: ["Alfa", "Nová beta"], points: 4 });
    expect(next.answerKeys.A[0].correctAnswer).toBe("Nová beta");
    expect(next.answerKeys.A[1].correctAnswer).toBe("Odpověď");
    expect(item.choices).toEqual(["Alfa", "Beta"]);
    expect(spec.answerKeys.A[0].correctAnswer).toBe("Beta");
  });

  it("tvrzení pravda/nepravda používá prompt a nemění správnou odpověď", () => {
    const item = { ...createDefaultItem("true_false", 1), id: "tf", prompt: "Staré tvrzení" };
    const spec = emptyWorksheetSpec();
    spec.variants[0].items = [item];
    spec.answerKeys.A = [{ itemId: "tf", itemNumber: 1, correctAnswer: "true" }];
    const next = applyWorksheetInlineTextEdit(spec, "tf", "prompt", "Nové tvrzení");
    expect(next.variants[0].items[0].prompt).toBe("Nové tvrzení");
    expect(next.answerKeys.A[0].correctAnswer).toBe("true");
  });

  it("Esc u vnořené možnosti nevyvolá zápis", () => {
    const edit = vi.fn();
    const item = { ...createDefaultItem("mcq", 1), choices: ["Alfa"] } as WorksheetItem;
    render(<MCQItem {...props} item={item} onEditText={edit} />);
    const box = screen.getByLabelText("Možnost A");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Omyl" } });
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.blur(box);
    expect(box).toHaveValue("Alfa");
    expect(edit).not.toHaveBeenCalled();
  });
});
