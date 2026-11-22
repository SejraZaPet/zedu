import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ActivityEditor from "@/components/activities/editor/ActivityEditor";
import ActivitySettingsPanel from "@/components/presentation/ActivitySettingsPanel";
import ActivityBlock from "@/components/admin/block-editors/ActivityBlock";
import { activityModelFromStep, activityModelToStep } from "@/lib/activity-step-adapter";
import { newStep, prepareSlidesForLiveLaunch, type ActivityStep } from "@/lib/studio-step";
import type { ActivityModel } from "@/lib/activity-model";

function StudioHarness({ initial, onModel }: { initial: ActivityStep; onModel?: (model: ActivityModel) => void }) {
  const [step, setStep] = useState(initial);
  return <ActivityEditor model={activityModelFromStep(step)} context="studio" teamsOn onChange={(next) => { onModel?.(next); setStep(activityModelToStep(next, step)); }} />;
}

describe("Jednotný editor aktivit", () => {
  it("prázdný Studio kvíz má čtyři odpovědi a při psaní žádnou nezahodí", () => {
    let latest: ActivityModel | undefined;
    render(<StudioHarness initial={newStep("mcq")} onModel={(model) => { latest = model; }} />);
    expect(screen.getAllByPlaceholderText(/Odpověď \d/)).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Otázka"), { target: { value: "Co je voda?" } });
    fireEvent.change(screen.getByLabelText("Odpověď 1"), { target: { value: "Kapalina" } });
    expect(latest?.options.map((option) => option.text)).toEqual(["Kapalina", "", "", ""]);
    expect(screen.getByDisplayValue("Kapalina")).toBeTruthy();
  });

  it("kvíz s více otázkami umí přidat otázku i prázdnou odpověď", () => {
    const initial = activityModelFromSpecForTest();
    const Harness = () => {
      const [model, setModel] = useState(initial);
      return <ActivityEditor model={model} context="presentation" onChange={setModel} />;
    };
    render(<Harness />);
    expect(screen.getByLabelText("Text otázky 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Přidat otázku" }));
    expect(screen.getByLabelText("Text otázky 2")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Přidat odpověď" })[0]);
    expect(screen.getByLabelText("Správná odpověď 3 otázky 1")).toBeTruthy();
  });

  it("slovní mrak má otázku, anonymitu i sdílené barvy", () => {
    render(<StudioHarness initial={newStep("wordcloud")} />);
    fireEvent.change(screen.getByPlaceholderText("Jaké slovo vás napadne?"), { target: { value: "Co vás dnes potěšilo?" } });
    expect(screen.getByDisplayValue("Co vás dnes potěšilo?")).toBeTruthy();
    expect(screen.getByText("Anonymní odpovědi")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Pozadí karty" })).toBeTruthy();
  });

  it("lekce použije stejný editor a zachová stará pole bloku", () => {
    const onChange = vi.fn();
    const block: any = { id: "lesson-1", type: "activity", props: { activityType: "quiz", title: "Lekce", required: true, legacy: 9, quiz: { questions: [{ question: "Stará?", answers: [{ text: "A", correct: true }] }] } } };
    const { container } = render(<ActivityBlock block={block} onChange={onChange} />);
    fireEvent.click(container.querySelector("button[aria-expanded]")!);
    fireEvent.change(screen.getByLabelText("Text otázky 1"), { target: { value: "Nová?" } });
    expect(screen.getByTestId("unified-activity-editor")).toBeTruthy();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.required).toBe(true);
    expect(next.legacy).toBe(9);
    expect(next.quiz.questions[0].question).toBe("Nová?");
  });

  it("panel projde úpravou, uložením, znovuotevřením a přípravou živé hry", () => {
    let current: any = { slideId: "s1", type: "activity", activitySpec: { activityType: "mcq", question: "", options: [], correctIndex: 0 } };
    let saved: any;
    const Harness = () => {
      const [slide, setSlide] = useState(current);
      return <ActivitySettingsPanel slide={slide} onSlideChange={(next) => { current = next; setSlide(next); }} onPrint={vi.fn()} onLaunch={vi.fn()} onClose={vi.fn()} />;
    };
    const view = render(<Harness />);
    fireEvent.change(screen.getByLabelText("Otázka"), { target: { value: "Hlavní město?" } });
    fireEvent.change(screen.getByLabelText("Odpověď 1"), { target: { value: "Praha" } });
    fireEvent.change(screen.getByLabelText("Odpověď 2"), { target: { value: "Brno" } });
    fireEvent.click(screen.getByLabelText("Správná odpověď 1"));
    saved = current;
    expect(saved.activitySpec.options.map((option: any) => option.text)).toEqual(["Praha", "Brno", "", ""]);
    view.unmount();
    current = saved;
    render(<Harness />);
    expect(screen.getByDisplayValue("Hlavní město?")).toBeTruthy();
    expect(screen.getByDisplayValue("Praha")).toBeTruthy();
    const live = prepareSlidesForLiveLaunch([saved]);
    expect(live.slides[0].activitySpec.question).toBe("Hlavní město?");
    expect(live.slides[0].activitySpec.options[0].correct).toBe(true);
  });
});

function activityModelFromSpecForTest(): ActivityModel {
  return {
    activityType: "quiz", title: "Kvíz", question: "", options: [], correctIndex: 0,
    questions: [{ question: "První?", answers: [{ text: "A", correct: true }, { text: "B", correct: false }] }],
    content: {}, settings: { timeLimitSec: null, points: 1, participation: "inherit" }, imageUrl: "", explanation: "",
  };
}
