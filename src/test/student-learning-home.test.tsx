import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onPractice: vi.fn(), invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/components/profile/ProfileAvatarBubble", () => ({ default: () => <div data-testid="learning-avatar" /> }));
vi.mock("@/components/BezlaiTutorChat", () => ({ default: ({ open }: { open: boolean }) => open ? <div>chat-open</div> : null }));
vi.mock("@/lib/student-learning-overview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/student-learning-overview")>()),
  loadStudentLearningOverview: vi.fn(async () => overview),
}));

const lessonGroups = [{ subject: "Přírodopis", lessons: [
  { id: "l1", title: "Buňka", textbook: "Přírodopis", subject: "Přírodopis" },
  { id: "l2", title: "Fotosyntéza", textbook: "Přírodopis", subject: "Přírodopis" },
] }];
const overview = {
  xp: 120,
  streakDays: 4,
  todaySessions: 0,
  dailyGoal: 1,
  masteredCount: 1,
  lessonGroups,
  topics: lessonGroups[0].lessons.map((lesson, index) => ({ ...lesson, masteryPercent: index ? 55 : 100, sessionsCount: 2, mastered: index === 0, lastPracticedAt: null })),
  activeSubject: "Přírodopis",
  currentTopicId: "l2",
  lastLesson: lessonGroups[0].lessons[1],
  weakLesson: null,
  missions: [
    { id: "daily", title: "Dokonči jedno krátké procvičování", detail: "Pět minut", state: "now" as const, action: "quiz" as const, lessonId: "l2" },
    { id: "lesson", title: "Rychlý kvíz: Fotosyntéza", detail: "Přírodopis", state: "bonus" as const, action: "quiz" as const, lessonId: "l2" },
  ],
  nextExam: { id: "e1", title: "Test z buněk", deadline: "2026-11-24T08:00:00", days: 3 },
};

import StudentLearningHome from "@/components/student/StudentLearningHome";

function renderHome() {
  return render(<MemoryRouter><StudentLearningHome
    userId="student-1"
    methods={[{ id: "m1", slug: "sq4r" }, { id: "m2", slug: "akrostika" }]}
    preferredIds={["m2"]}
    onPractice={mocks.onPractice}
  /></MemoryRouter>);
}

describe("Učím se – režimy podle záměru", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("ukáže skutečný denní pokrok, mise a všech osm srozumitelných režimů", async () => {
    renderHome();
    expect(await screen.findByRole("heading", { name: "Co dnes zvládneš?" })).toBeInTheDocument();
    expect(screen.getByText("Série: 4 dny")).toBeInTheDocument();
    expect(screen.getByText("120 XP")).toBeInTheDocument();
    expect(screen.getByText("1 zvládnuté téma")).toBeInTheDocument();
    for (const title of ["Chci si to zapamatovat", "Vyzkoušej se z toho", "Blíží se test", "Můj materiál", "Shrnutí", "Cesta po tématech", "Zeptej se Zedíka", "Triky na učení"]) {
      expect(screen.getByRole("button", { name: new RegExp(title) })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Blíží se test: Test za 3 dny" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dokonči jedno krátké procvičování, Právě teď" })).toBeInTheDocument();
  });

  it("rychlý kvíz použije oblíbenou metodu, poslední lekci a pět minut", async () => {
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Vyzkoušej se z toho: Rychlý kvíz" }));
    expect(mocks.onPractice).toHaveBeenCalledWith({ id: "m2", slug: "akrostika" }, "l2", 5);
  });

  it("kartičky vytvoří stávající funkcí, označí AI a umožní otočení", async () => {
    mocks.invoke.mockResolvedValue({ data: { cards: [{ front: "Co je buňka?", back: "Základní jednotka života." }] }, error: null });
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Chci si to zapamatovat: Kartičky" }));
    fireEvent.click(screen.getByRole("button", { name: "Vytvořit kartičky" }));
    const card = await screen.findByRole("button", { name: "Kartička 1: Co je buňka?" });
    expect(mocks.invoke).toHaveBeenCalledWith("lesson-study-helper", { body: { lesson_id: "l2", mode: "cards" } });
    expect(screen.getByText("AI generováno")).toBeInTheDocument();
    fireEvent.click(card);
    expect(screen.getByRole("button", { name: "Kartička 1: Základní jednotka života." })).toHaveAttribute("aria-pressed", "true");
  });

  it("shrnutí použije stejnou existující funkci a označí AI výstup", async () => {
    mocks.invoke.mockResolvedValue({ data: { bullets: ["Buňka má membránu."] }, error: null });
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Shrnutí: To nejdůležitější z lekce" }));
    fireEvent.click(screen.getByRole("button", { name: "Vytvořit shrnutí" }));
    expect(await screen.findByText("Buňka má membránu.")).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("lesson-study-helper", { body: { lesson_id: "l2", mode: "summary" } });
    expect(screen.getByText("AI generováno")).toBeInTheDocument();
  });

  it("cesta ukáže hotovo, právě teď a chat se otevře bez nového backendu", async () => {
    renderHome();
    expect(await screen.findByText("Zvládnuto")).toBeInTheDocument();
    expect(screen.getByText("Právě teď", { selector: ".text-xs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zeptej se Zedíka: Nasměruje tě k odpovědi" }));
    await waitFor(() => expect(screen.getByText("chat-open")).toBeInTheDocument());
  });
});
