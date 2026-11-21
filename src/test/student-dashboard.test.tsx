import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  ensureNotebooks: vi.fn(async () => undefined),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-student-id" }, loading: false }),
}));
vi.mock("@/lib/notebook", () => ({ ensureMyCourseNotebooks: mocks.ensureNotebooks }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              first_name: "Test",
              last_name: "Žák",
              email: "test@example.invalid",
              school: "[TEST] Škola",
              field_of_study: "[TEST] Obor",
              year: 2,
              username: "test-zak",
              student_code: "TEST-CODE-123",
            },
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div /> }));
vi.mock("@/components/dashboard/DashboardBanners", () => ({ default: () => <div data-testid="dashboard-banners" /> }));
vi.mock("@/components/dashboard/BannersNewsButton", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileAvatarBubble", () => ({
  default: ({ shape, size }: { shape?: string; size?: number }) => <span data-testid="student-avatar" data-shape={shape} data-size={size} />,
}));
vi.mock("@/components/calendar/TodayWidget", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ onOpenAssignmentsChange }: { onOpenAssignmentsChange?: (count: number) => void }) => {
      useEffect(() => { onOpenAssignmentsChange?.(2); }, [onOpenAssignmentsChange]);
      return <section data-testid="today-widget"><a href="/student/rozvrh">Rozvrh třídy</a><a href="/student/kalendar">Můj kalendář</a></section>;
    },
  };
});
vi.mock("@/components/student/UpcomingExamsCard", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ onCountChange }: { onCountChange?: (count: number) => void }) => {
      useEffect(() => { onCountChange?.(3); }, [onCountChange]);
      return <section data-testid="upcoming-exams">Co mě čeká</section>;
    },
  };
});
vi.mock("@/components/student/MyLeagueCard", () => ({ default: () => <div>Liga</div> }));
vi.mock("@/components/student/PlayerProfileWidget", () => ({ default: () => <div>Profil hráče</div> }));
vi.mock("@/components/student/StudentProgressWidgets", () => ({ default: () => <div>Pokrok</div> }));
vi.mock("@/components/behavior/RecognitionWidget", () => ({ default: () => <div>Ocenění</div> }));

import StudentDashboard from "@/pages/StudentDashboard";

async function renderDashboard() {
  render(<MemoryRouter><StudentDashboard /></MemoryRouter>);
  await screen.findByRole("heading", { name: "Ahoj, Test! 👋" });
  await screen.findByRole("link", { name: "Učím se, počet nadcházejících testů: 3" });
}

describe("Žákovský přehled – etapa 1", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("hlavní dlaždice mají správné cesty, popisky a ikony", async () => {
    await renderDashboard();
    const expected = [
      ["learn", "/student/metody", "lucide-graduation-cap"],
      ["textbooks", "/student/ucebnice", "lucide-book"],
      ["assignments", "/student/ulohy", "lucide-square-check-big"],
      ["subjects", "/student/predmety", "lucide-library"],
      ["notebook", "/student/sesit", "lucide-notebook-text"],
      ["portfolio", "/student/portfolio", "lucide-folder-open"],
      ["schedule", "/student/rozvrh", "lucide-calendar-days"],
    ];
    for (const [id, href, icon] of expected) {
      const link = screen.getByTestId(`student-tile-${id}`);
      expect(link).toHaveAttribute("href", href);
      expect(link.querySelector("svg")).toHaveClass(icon);
    }
    expect(screen.getByText("Kartičky, kvízy a příprava na test z látky tvého učitele")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Moje předměty/ })).toHaveAttribute("href", "/student/predmety");
    expect(screen.getByText("Třídy a kurzy")).toBeInTheDocument();
  });

  it("kompaktní dlaždice zachovají všechny cesty a hra používá Gamepad2", async () => {
    await renderDashboard();
    const expected = [
      ["join-game", "/live/pripojit", "lucide-gamepad2"],
      ["todos", "/todo", "lucide-clipboard-check"],
      ["books", "/student/knihy", "lucide-book"],
      ["academy", "/student/akademie", "lucide-graduation-cap"],
      ["leaderboard", "/student/zebricek", "lucide-trophy"],
      ["from-material", "/student/z-materialu", "lucide-folder-open"],
    ];
    for (const [id, href, icon] of expected) {
      const link = screen.getByTestId(`student-tile-${id}`);
      expect(link).toHaveAttribute("href", href);
      expect(link.querySelector("svg")).toHaveClass(icon);
    }
  });

  it("Dnes je po banerech a před dlaždicemi; původní odkazy zůstaly", async () => {
    await renderDashboard();
    const banners = screen.getByTestId("dashboard-banners");
    const today = screen.getByTestId("student-today-slot");
    const main = screen.getByTestId("student-main-links");
    expect(banners.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(today.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const href of ["/student/ucebnice", "/student/ulohy", "/student/kalendar", "/live/pripojit", "/todo", "/student/metody"]) {
      expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  });

  it("počty pocházejí z předaných dat a kód žáka i profil zůstávají viditelné", async () => {
    await renderDashboard();
    expect(screen.getByRole("link", { name: "Učím se, počet nadcházejících testů: 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Úlohy, počet k odevzdání: 2" })).toBeInTheDocument();
    expect(screen.getByText("TEST-CODE-123")).toBeVisible();
    expect(screen.getByText(/Kód žáka předejte svému rodiči/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Upravit profil" })).toBeInTheDocument();
  });

  it("avatar je čtvercový, velký 96 px a zůstává v hlavičce", async () => {
    await renderDashboard();
    expect(screen.getByTestId("student-avatar")).toHaveAttribute("data-shape", "square");
    expect(screen.getByTestId("student-avatar")).toHaveAttribute("data-size", "96");
  });
});
