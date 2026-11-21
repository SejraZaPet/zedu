import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentCourse } from "@/lib/student-courses";

const mocks = vi.hoisted(() => ({ fetchCourses: vi.fn(), navigate: vi.fn(), user: { id: "student-1" } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/student-courses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/student-courses")>()),
  fetchStudentCourses: mocks.fetchCourses,
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div /> }));

import StudentSubjects, { coursePalette } from "@/pages/StudentSubjects";

const course = (overrides: Partial<StudentCourse>): StudentCourse => ({
  id: "course-1", subjectId: "subject-1", subjectName: "Matematika", audienceName: "8. A",
  audienceKind: "class", classId: "class-1", groupId: null,
  target: "/student/predmet/Matematika/trida/class-1", slots: [], openAssignments: 0,
  hasUpcomingExam: false, nextLesson: null, ...overrides,
});

async function renderPage(rows: StudentCourse[]) {
  mocks.fetchCourses.mockResolvedValue(rows);
  render(<MemoryRouter><StudentSubjects /></MemoryRouter>);
  await screen.findByRole("heading", { name: "Moje předměty" });
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
}

describe("Žákovská stránka Moje předměty", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("karta třídy i skupiny vede na stávající StudentSubjectClass", async () => {
    await renderPage([
      course({ openAssignments: 2, hasUpcomingExam: true }),
      course({ id: "course-2", subjectId: "subject-2", subjectName: "Fyzika", audienceName: "Odpolední skupina",
        audienceKind: "group", classId: null, groupId: "group-1", target: "/student/predmet/Fyzika/skupina/group-1" }),
    ]);
    expect(await screen.findByRole("link", { name: "Předmět Matematika, třída 8. A" }))
      .toHaveAttribute("href", "/student/predmet/Matematika/trida/class-1");
    expect(screen.getByRole("link", { name: "Předmět Fyzika, skupina Odpolední skupina" }))
      .toHaveAttribute("href", "/student/predmet/Fyzika/skupina/group-1");
    expect(screen.getByText("2 úlohy k odevzdání")).toBeInTheDocument();
    expect(screen.getByText("Test do 14 dní")).toBeInTheDocument();
  });

  it("prázdný stav vysvětlí připojení kódem bez vymyšlené nové cesty", async () => {
    await renderPage([]);
    expect(await screen.findByText("Zatím nejsi v žádné třídě ani skupině. Požádej učitele o kód nebo se připoj kódem.")).toBeVisible();
    expect(screen.getByText("Kód třídy se zadává při registraci.")).toBeVisible();
    expect(screen.queryByTestId("student-course-card")).not.toBeInTheDocument();
  });

  it("cesta je chráněná stejně jako ostatní žákovské stránky a dlaždice na ni odkazuje", () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, "utf8");
    const dashboard = readFileSync(`${process.cwd()}/src/pages/StudentDashboard.tsx`, "utf8");
    expect(app).toContain('path="/student/predmety" element={<ProtectedRoute><StudentSubjects /></ProtectedRoute>}');
    expect(dashboard).toContain('to: "/student/predmety"');
  });

  it("barevná paleta je stabilní pro stejné id a mění se podle předmětu", () => {
    expect(coursePalette(course({}))).toEqual(coursePalette(course({ subjectName: "Přejmenovaný předmět" })));
    expect(coursePalette(course({ subjectId: "subject-1" }))).not.toEqual(coursePalette(course({ subjectId: "subject-2" })));
  });
});
