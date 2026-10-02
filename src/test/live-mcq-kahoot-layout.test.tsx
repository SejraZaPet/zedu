import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuizActivity from "@/components/activities/QuizActivity";
import ActivityTaskPreview from "@/components/live/ActivityTaskPreview";
import { McqAnswerDistribution } from "@/components/live/LiveMcqWidgets";

const answers = [
  { text: "Praha", correct: true },
  { text: "Brno", correct: false },
  { text: "Ostrava", correct: false },
  { text: "Plzeň", correct: false },
  { text: "Liberec", correct: false },
];

describe("živé MCQ se sdílenou obrazovkou", () => {
  it("žákovi skryje texty a zpřístupní i pátou tvarovou volbu", () => {
    const onSubmit = vi.fn();
    render(<QuizActivity quiz={{ question: "Hlavní město?", answers }} live={{ revealed: false, onSubmit }} />);

    expect(screen.queryByText("Praha")).not.toBeInTheDocument();
    expect(screen.queryByText("Hlavní město?")).not.toBeInTheDocument();
    const choices = screen.getAllByRole("button", { name: /Možnost/ });
    expect(choices).toHaveLength(5);

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