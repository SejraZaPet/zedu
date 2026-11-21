import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("@/hooks/useStudentPracticeLessons", () => ({
  useStudentPracticeLessons: () => ({ data: lessonGroups, isPending: false, isError: false }),
}));

const lessonGroups = [
  { subject: "Přírodopis", lessons: [
    { id: "l1", title: "Buňka", textbook: "Přírodopis", subject: "Přírodopis" },
    { id: "l2", title: "Fotosyntéza", textbook: "Přírodopis", subject: "Přírodopis" },
  ] },
  { subject: "Matematika", lessons: [
    { id: "m1", title: "Zlomky", textbook: "Matematika", subject: "Matematika" },
  ] },
  { subject: "Ostatní", lessons: Array.from({ length: 9 }, (_, index) => ({
    id: `other-${index + 1}`,
    title: `Volná ${index + 1}`,
    textbook: "Vlastní učebnice",
    subject: "Ostatní",
  })) },
];
const allLessons = lessonGroups.flatMap((group) => group.lessons);
const overview = {
  xp: 120,
  streakDays: 4,
  todaySessions: 0,
  dailyGoal: 1,
  masteredCount: 1,
  lessonGroups,
  topics: allLessons.map((lesson, index) => ({ ...lesson, masteryPercent: index ? 55 : 100, sessionsCount: 2, mastered: index === 0, lastPracticedAt: null })),
  activeSubject: "Přírodopis",
  currentTopicId: "l2",
  lastLesson: lessonGroups[0].lessons[1],
  weakLesson: null,
  missions: [
    { id: "daily", title: "Dokonči jedno krátké procvičování", detail: "Pět minut", state: "now" as const, action: "quiz" as const, lessonId: "l2" },
    { id: "lesson", title: "Rychlý kvíz: Fotosyntéza", detail: "Přírodopis", state: "bonus" as const, action: "quiz" as const, lessonId: "l2" },
  ],
  nextExam: { id: "e1", title: "Test z buněk", deadline: "2026-11-24T08:00:00", days: 3, lessonIds: [] as string[] },
};

import StudentLearningHome from "@/components/student/StudentLearningHome";
import { loadStudentLearningOverview } from "@/lib/student-learning-overview";

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;

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

  it("přepínač cesty uloží předmět pro stejného žáka a dlaždice přesune fokus", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const view = renderHome();
    const pathTile = await screen.findByRole("button", { name: "Cesta po tématech: Podívej se, co už umíš" });
    fireEvent.click(pathTile);
    expect(screen.getByRole("group", { name: "Předmět cesty" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Matematika" }));
    expect(screen.getByText("Zlomky")).toBeInTheDocument();
    expect(window.localStorage.getItem("bezli:learning-subject:student-1")).toBe("Matematika");

    view.unmount();
    renderHome();
    expect(await screen.findByText("Zlomky")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matematika" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Ostatní prohledá sdíleným výběrem a dlouhou cestu rozbalí po osmi", async () => {
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Ostatní" }));
    const path = screen.getByRole("region", { name: "Moje cesta" });
    expect(within(path).getAllByRole("button", { name: "Procvičit" })).toHaveLength(8);
    expect(within(path).getByRole("button", { name: "Zobrazit další (1)" })).toBeInTheDocument();

    fireEvent.click(within(path).getByRole("combobox", { name: "Vyhledat v Ostatních" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Hledat lekci bez předmětu" }), { target: { value: "volna 9" } });
    fireEvent.click(await screen.findByRole("option", { name: /Volná 9/ }));
    const title = within(path).getByText("Volná 9", { selector: ".block.font-medium" });
    fireEvent.click(within(title.closest("li")!).getByRole("button", { name: "Procvičit" }));
    expect(mocks.onPractice).toHaveBeenCalledWith({ id: "m2", slug: "akrostika" }, "other-9", 5);
  });

  it("Ostatní nabídnou hledání i při sedmi lekcích", async () => {
    const otherGroup = lessonGroups.find((group) => group.subject === "Ostatní")!;
    const seven = otherGroup.lessons.slice(0, 7);
    vi.mocked(loadStudentLearningOverview).mockResolvedValueOnce({
      ...overview,
      lessonGroups: [{ subject: "Ostatní", lessons: seven }],
      topics: overview.topics.filter((topic) => seven.some((lesson) => lesson.id === topic.id)),
      activeSubject: "Ostatní",
      currentTopicId: seven[0].id,
      nextExam: null,
    });
    renderHome();
    fireEvent.click(await screen.findByRole("combobox", { name: "Vyhledat v Ostatních" }));
    expect(screen.getByRole("combobox", { name: "Hledat lekci bez předmětu" })).toBeInTheDocument();
  });

  it("navázaný test spustí patnáctiminutovou přípravu z dostupné lekce", async () => {
    vi.mocked(loadStudentLearningOverview).mockResolvedValueOnce({
      ...overview,
      nextExam: { ...overview.nextExam, lessonIds: ["l1"] },
    });
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Blíží se test: 15 min · nejdřív slabá místa" }));
    expect(mocks.onPractice).toHaveBeenCalledWith({ id: "m2", slug: "akrostika" }, "l1", 15);
  });

  it("bez dostupné vazby nebo bez testu zůstane původní pětiminutový kvíz", async () => {
    vi.mocked(loadStudentLearningOverview).mockResolvedValueOnce({
      ...overview,
      nextExam: { ...overview.nextExam, lessonIds: ["nedostupna"] },
    });
    const view = renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Blíží se test: Test za 3 dny" }));
    expect(mocks.onPractice).toHaveBeenCalledWith({ id: "m2", slug: "akrostika" }, "l2", 5);

    view.unmount();
    mocks.onPractice.mockClear();
    vi.mocked(loadStudentLearningOverview).mockResolvedValueOnce({ ...overview, nextExam: null });
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Žádný test na obzoru: Zopakuj si poslední lekci" }));
    expect(mocks.onPractice).toHaveBeenCalledWith({ id: "m2", slug: "akrostika" }, "l2", 5);
  });
});
