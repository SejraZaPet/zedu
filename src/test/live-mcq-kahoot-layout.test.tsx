import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuizActivity from "@/components/activities/QuizActivity";
import ActivityTaskPreview from "@/components/live/ActivityTaskPreview";
import { McqAnswerDistribution } from "@/components/live/LiveMcqWidgets";
import { StudentGameQuestion } from "@/components/game/StudentGameQuestion";
import { GameProjector } from "@/components/game/GameProjector";
import { coreToGameQuestions } from "@/lib/live-game-core";
import { getMcqOptionVisualIndex } from "@/lib/mcq-option-visuals";

const answers = [
  { text: "Praha", correct: true },
  { text: "Brno", correct: false },
  { text: "Ostrava", correct: false },
  { text: "Plzeň", correct: false },
  { text: "Liberec", correct: false },
];

describe("živé MCQ se sdílenou obrazovkou", () => {
  it("odesílá stejný index i s texty a pátou tvarovou volbou", () => {
    const onSubmit = vi.fn();
    render(<QuizActivity quiz={{ question: "Hlavní město?", answers }} live={{ revealed: false, onSubmit }} />);

    expect(screen.queryByText("Hlavní město?")).not.toBeInTheDocument();
    const choices = screen.getAllByRole("button", { name: /Možnost/ });
    expect(choices).toHaveLength(5);
    expect(choices[0]).toHaveClass("bg-answer-red");
    expect(choices[1]).toHaveClass("bg-answer-blue");
    expect(choices[4]).toHaveClass("bg-answer-purple");

    fireEvent.click(choices[4]);
    expect(onSubmit).toHaveBeenCalledWith(false, [4]);
    expect(screen.getByText(/Odpověď odeslána/)).toBeInTheDocument();
  });

  it("projekce ukáže texty možností a po zveřejnění označí správnou", () => {
    render(<ActivityTaskPreview spec={{ activityType: "mcq", options: answers }} showSolution />);

    expect(screen.getByText("Praha")).toBeInTheDocument();
    expect(screen.getByText("Liberec")).toBeInTheDocument();
    expect(screen.getByLabelText("Správná odpověď")).toBeInTheDocument();
  });

  it("graf spočítá jednotlivé vybrané možnosti", () => {
    render(
      <McqAnswerDistribution
        questionIndex={2}
        options={answers}
        responses={[
          { question_index: 2, answer: { selected: [0] } },
          { question_index: 2, answer: { selected: [0] } },
          { question_index: 2, answer: { selected: [4] } },
          { question_index: 1, answer: { selected: [1] } },
        ]}
      />,
    );

    expect(screen.getByText("červený trojúhelník: 2 odpovědí")).toBeInTheDocument();
    expect(screen.getByText("fialová hvězda: 1 odpovědí")).toBeInTheDocument();
  });
});
describe("živé MCQ Pravda/Nepravda", () => {
  it.each([true, false])("Pravda je modrá a Nepravda červená; správná je Pravda = %s", (trueIsCorrect) => {
    render(<QuizActivity quiz={{ question: "Výrok", answers: [{ text: "Pravda", correct: trueIsCorrect }, { text: "Nepravda", correct: !trueIsCorrect }] }} live={{ revealed: false, onSubmit: () => {} }} />);
    const truth = screen.getByRole("button", { name: "Možnost 1: Pravda (modrý kosočtverec)" });
    const lie = screen.getByRole("button", { name: "Možnost 2: Nepravda (červený trojúhelník)" });
    expect(truth).toHaveClass("bg-answer-blue");
    expect(lie).toHaveClass("bg-answer-red");
    expect(truth).toHaveTextContent("Pravda");
    expect(lie).toHaveTextContent("Nepravda");
    expect(screen.queryByText("Výrok")).not.toBeInTheDocument();
  });

  it("barvu určí text i při obráceném pořadí; data a správný index se nepřehodí", () => {
    const input = [{ question: "Výrok", answers: ["Nepravda", "Pravda"], correctIndex: 1 }];
    const converted = coreToGameQuestions(input)[0];
    expect(converted.type).toBe("true_false");
    expect(converted.answers.map((answer) => answer.text)).toEqual(["Nepravda", "Pravda"]);
    expect(converted.answers.map((answer) => answer.correct)).toEqual([false, true]);
    expect(getMcqOptionVisualIndex(converted.answers, 0)).toBe(0);
    expect(getMcqOptionVisualIndex(converted.answers, 1)).toBe(1);
    expect(getMcqOptionVisualIndex([{ text: "Ano" }, { text: "Ne" }], 0)).toBe(0);
  });

  it("učitelský náhled a projekční výsledky použijí stejné barvy a popisky", () => {
    const options = [{ text: "Pravda", correct: false }, { text: "Nepravda", correct: true }];
    const { unmount } = render(<ActivityTaskPreview spec={{ activityType: "mcq", options }} showSolution />);
    expect(screen.getByText("Pravda").closest("div")).toHaveClass("bg-answer-blue");
    expect(screen.getByText("Nepravda").closest("div")).toHaveClass("bg-answer-red");
    unmount();
    render(<McqAnswerDistribution questionIndex={0} options={options} responses={[{ question_index: 0, answer: { selected: [0] } }]} />);
    expect(screen.getByText("modrý kosočtverec: 1 odpovědí")).toBeInTheDocument();
    expect(screen.getByText("červený trojúhelník: 0 odpovědí")).toBeInTheDocument();
  });

  it("starý telefon /hra má Pravdu modrou a Nepravdu červenou", () => {
    render(<StudentGameQuestion
      question={{ question: "Výrok", type: "true_false", answers: [{ text: "Pravda", correct: true }, { text: "Nepravda", correct: false }] }}
      questionIndex={0} totalQuestions={1} hasAnswered={false} lastResult={null} onAnswer={() => {}}
      timeLimit={30_000} questionStarted={Date.now()} status="playing"
    />);
    expect(screen.getByRole("button", { name: /Pravda/ })).toHaveClass("bg-answer-blue");
    expect(screen.getByRole("button", { name: /Nepravda/ })).toHaveClass("bg-answer-red");
  });

  it("starý projektor /hra použije stejné barvy a tvary", () => {
    const question = { question: "Výrok", answers: [{ text: "Pravda", correct: true }, { text: "Nepravda", correct: false }], type: "true_false" as const };
    render(<GameProjector
      session={{ current_question_index: 0, activity_data: [question], status: "playing", settings: { gameMode: "standard" }, teams: { teams: [] } } as any}
      players={[]} responses={[]} countdown={null} onShowResults={() => {}} onNext={() => {}} onEnd={() => {}}
    />);
    expect(screen.getByText("Pravda").closest("div")).toHaveClass("bg-blue-500");
    expect(screen.getByText("Nepravda").closest("div")).toHaveClass("bg-red-500");
  });
});
