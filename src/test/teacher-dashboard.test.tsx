import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "teacher-test" },
  role: "teacher",
  counts: { assignments: 4, todos: 2, notifications: 3 },
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  rectSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: undefined, isDragging: false }),
}));
vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: () => "" } } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, role: mocks.role, loading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { first_name: "[TEST]", last_name: "Učitel", email: "test@example.invalid", school: "[TEST] Škola" },
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/teacher-dashboard-counts", () => ({
  EMPTY_DASHBOARD_COUNTS: { assignments: null, todos: null, notifications: null },
  loadTeacherDashboardCounts: async () => mocks.counts,
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => <div>Hlavička</div> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div>Patička</div> }));
vi.mock("@/components/dashboard/DashboardBanners", () => ({ default: () => <div>Banery</div> }));
vi.mock("@/components/dashboard/BannersNewsButton", () => ({ default: () => <button>Novinky</button> }));
vi.mock("@/components/calendar/TodayWidget", () => ({ default: () => <div data-testid="today-widget">Dnes</div> }));
vi.mock("@/components/profile/ProfileAvatarBubble", () => ({
  default: ({ shape, size }: { shape?: string; size: number }) => <div data-testid="teacher-avatar" data-shape={shape} data-size={size} />,
}));

import TeacherDashboard from "@/pages/TeacherDashboard";
import {
  TEACHER_DASHBOARD_LEGACY_STORAGE_KEY,
  TEACHER_DASHBOARD_STORAGE_KEY,
} from "@/lib/teacher-dashboard-order";

const expectedTiles = [
  ["activities", "/ucitel/studio", "gamepad2"],
  ["review", "/ucitel/ke-kontrole", "list-checks"],
  ["classroom-tools", "/ucitel/nastroje", "timer"],
  ["assignments", "/ucitel/ulohy", "square-check-big"],
  ["results", "/ucitel/vysledky", "chart-column"],
  ["textbooks", "/ucitel/ucebnice", "book"],
  ["worksheets", "/ucitel/pracovni-listy", "file-text"],
  ["lesson-plans", "/ucitel/plany-hodin", "list"],
  ["suggest-method", "/ucitel/navrh-podle-metody", "wand-sparkles"],
  ["classes", "/ucitel/tridy", "school"],
  ["subjects", "/ucitel/predmety", "library"],
  ["svp", "/ucitel/svp", "landmark"],
  ["notifications", "/ucitel/notifikace", "bell"],
  ["calendar", "/ucitel/kalendar", "calendar-days"],
  ["todos", "/todo", "clipboard-check"],
  ["academy", "/ucitel/akademie", "graduation-cap"],
] as const;

async function renderDashboard() {
  render(<MemoryRouter><TeacherDashboard /></MemoryRouter>);
  await screen.findByText("[TEST] Učitel");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.role = "teacher";
  mocks.counts = { assignments: 4, todos: 2, notifications: 3 };
});
afterEach(() => cleanup());

describe("Učitelský přehled – etapa U1", () => {
  it("zachová všech 16 dnešních cest a správné ikony", async () => {
    await renderDashboard();
    for (const [id, path, icon] of expectedTiles) {
      const tile = screen.getByTestId(`teacher-tile-${id}`);
      expect(tile).toHaveAttribute("href", path);
      expect(tile.querySelector(`svg.lucide-${icon}`), id).not.toBeNull();
    }
    expect(expectedTiles).toHaveLength(16);
  });

  it("má Dnes před dlaždicemi, pevné skupiny a profil dole", async () => {
    await renderDashboard();
    const today = screen.getByTestId("teacher-today-slot");
    const priority = screen.getByTestId("teacher-priority-links");
    expect(today.compareDocumentPosition(priority) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vyučuji dnes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Příprava hodin" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Třídy a předměty" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pro mě" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Můj profil" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Upravit profil" })).toBeVisible();
    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-shape", "square");
    expect(screen.getByTestId("teacher-avatar")).toHaveAttribute("data-size", "96");
  });

  it("ukazuje pouze existující počty a žádný počet Ke kontrole", async () => {
    await renderDashboard();
    await waitFor(() => expect(within(screen.getByTestId("teacher-tile-assignments")).getByText("4")).toBeVisible());
    expect(within(screen.getByTestId("teacher-tile-todos")).getByText("2")).toBeVisible();
    expect(within(screen.getByTestId("teacher-tile-notifications")).getByText("3")).toBeVisible();
    expect(screen.getByTestId("teacher-tile-assignments")).toHaveAttribute("aria-label", "Úlohy pro žáky, počet zveřejněných úloh: 4");
    for (const id of ["review", "activities", "calendar", "results"]) {
      expect(screen.getByTestId(`teacher-tile-${id}`).querySelector(".dashboard-tile-count, .dashboard-compact-tile-count")).toBeNull();
    }
  });

  it("migruje v1 do v2 v úložišti a Obnovit pořadí vrátí výchozí skupiny", async () => {
    localStorage.setItem(TEACHER_DASHBOARD_LEGACY_STORAGE_KEY, JSON.stringify(["profile", "results", "today", "classroom-tools", "assignments"]));
    await renderDashboard();
    await waitFor(() => expect(localStorage.getItem(TEACHER_DASHBOARD_STORAGE_KEY)).not.toBeNull());
    const teaching = screen.getByTestId("teacher-group-teaching");
    expect(within(teaching).getAllByRole("link").map((link) => link.getAttribute("data-testid"))).toEqual([
      "teacher-tile-results", "teacher-tile-classroom-tools", "teacher-tile-assignments",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Obnovit pořadí" }));
    expect(within(teaching).getAllByRole("link").map((link) => link.getAttribute("data-testid"))).toEqual([
      "teacher-tile-classroom-tools", "teacher-tile-assignments", "teacher-tile-results",
    ]);
  });

  it("lektor vidí stejné dlaždice a vlastní název panelu", async () => {
    mocks.role = "lektor";
    await renderDashboard();
    expect(screen.getByText(/Lektorský panel/)).toBeVisible();
    expect(expectedTiles.every(([id]) => screen.getByTestId(`teacher-tile-${id}`))).toBe(true);
  });
});
