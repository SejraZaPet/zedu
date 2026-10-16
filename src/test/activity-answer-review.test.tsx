import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ActivityAnswerReview } from "@/components/activities/ActivityAnswerReview";
import { readActivityAnswers } from "@/lib/activity-answers";
import { bestResultsByActivity } from "@/lib/lesson-activity-progress";
import TrueFalseActivity from "@/components/activities/TrueFalseActivity";
import QuizActivity from "@/components/activities/QuizActivity";
import MatchingActivity from "@/components/activities/MatchingActivity";
import FillBlanksActivity from "@/components/activities/FillBlanksActivity";
import { LessonBlock } from "@/components/LessonBlockRenderer";

afterEach(cleanup);
const snapshot = { index: 0, text: "Potraviny", studentAnswer: "Nepravda", correctAnswer: "Pravda", correct: false, explanation: "Vysvětlení" };

describe("uložené odpovědi", () => {
  it("odmítá stará a neplatná data", () => {
    for (const value of [null, undefined, [], {}, [{ index: 0 }], [snapshot, snapshot]]) expect(readActivityAnswers(value)).toBeUndefined();
    expect(readActivityAnswers([snapshot])).toEqual([snapshot]);
  });
  it("odpovědi zůstávají s nejlepším výsledkem, ne s posledním pokusem", () => {
    const best = bestResultsByActivity([
      { activity_index: 3, score: 1, max_score: 1, answers: [snapshot], completed_at: "2026-10-16T09:00:00Z" },
      { activity_index: 3, score: 0, max_score: 1, answers: [{ ...snapshot, text: "Jiný pokus" }], completed_at: "2026-10-16T10:00:00Z" },
    ]);
    expect(best.get(3)?.answers).toEqual([snapshot]);
  });
  it("zobrazí znění, obě odpovědi, značku a vysvětlení až na vyžádání", () => {
    render(<ActivityAnswerReview answers={[snapshot, { ...snapshot, index: 1, correct: true }]} />);
    expect(screen.queryByText("Tvoje odpověď: Nepravda")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat odpovědi" }));
    expect(screen.getAllByText("Tvoje odpověď: Nepravda")).toHaveLength(2);
    expect(screen.getAllByText("Správná odpověď: Pravda")).toHaveLength(2);
    expect(screen.getAllByText("Vysvětlení")).toHaveLength(2);
    expect(screen.getByLabelText("Nesprávně")).toBeTruthy();
    expect(screen.getByLabelText("Správně")).toBeTruthy();
  });
  it("obnovený blok nabízí přehled, starý výsledek pouze opakování", () => {
    const block = { id: "activity", type: "activity", props: { activityType: "true_false", trueFalse: { statements: [{ text: "Potraviny", isTrue: true }] } } } as any;
    const result = { score: 0, maxScore: 1, ratio: 0, completedAt: null, answers: [snapshot] };
    const { rerender } = render(<LessonBlock block={block} isCompleted completedResult={result} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("button", { name: "Zkontrolovat odpovědi" })).toBeTruthy();
    rerender(<LessonBlock block={block} isCompleted completedResult={{ ...result, answers: undefined }} />);
    expect(screen.queryByRole("button", { name: "Zkontrolovat odpovědi" })).toBeNull();
    expect(screen.getByRole("button", { name: "Zkusit znovu" })).toBeTruthy();
  });
});

describe("snapshot automaticky hodnocených aktivit", () => {
  it("pravda/nepravda zachová skóre a odpovědi včetně vysvětlení", () => {
    const complete = vi.fn();
    render(<TrueFalseActivity statements={[{ text: "Výrok", isTrue: true, explanation: "Proč" }]} onComplete={complete} />);
    fireEvent.click(screen.getByRole("button", { name: "Nepravda" }));
    fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat" }));
    expect(complete).toHaveBeenCalledWith(0, 1, [{ index: 0, text: "Výrok", studentAnswer: "Nepravda", correctAnswer: "Pravda", correct: false, explanation: "Proč" }]);
  });
  it("kvíz uloží skutečný výběr, vysvětlení a součet", () => {
    const complete = vi.fn();
    render(<QuizActivity quiz={{ question: "Otázka", answers: [{ text: "Ano", correct: true }, { text: "Ne", correct: false }], explanation: "Proč" }} onComplete={complete} />);
    fireEvent.click(screen.getByRole("button", { name: "Ne", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Ověřit odpověď" }));
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledek" }));
    expect(complete).toHaveBeenCalledWith(0, 1, [{ index: 0, text: "Otázka", studentAnswer: "Ne", correctAnswer: "Ano", correct: false, explanation: "Proč" }]);
  });
  it("přiřazování ukládá texty, nikoli zamíchanou pozici", () => {
    const complete = vi.fn();
    render(<MatchingActivity matching={{ left: ["A", "B"], right: ["X", "Y"] }} onComplete={complete} />);
    const inputs = screen.getAllByRole("combobox");
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(inputs[1], { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Zkontrolovat/i }));
    expect(complete.mock.calls[0]?.[2]).toEqual([
      { index: 0, text: "A", studentAnswer: "Y", correctAnswer: "X", correct: false },
      { index: 1, text: "B", studentAnswer: "X", correctAnswer: "Y", correct: false },
    ]);
  });
  it("doplňování respektuje alternativy a původní normalizaci", () => {
    const complete = vi.fn();
    render(<FillBlanksActivity text="Je to {{ovoce/jablko}}." onComplete={complete} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "JABLKO" } });
    fireEvent.click(screen.getByRole("button", { name: "Zkontrolovat" }));
    expect(complete.mock.calls[0]?.slice(0, 2)).toEqual([1, 1]);
    expect(complete.mock.calls[0]?.[2][0]).toMatchObject({ studentAnswer: "JABLKO", correctAnswer: "ovoce / jablko", correct: true });
  });
});