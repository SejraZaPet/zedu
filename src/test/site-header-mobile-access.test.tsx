import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";

const mockUseAuth = vi.fn();
const signOut = vi.fn();

vi.mock("@/assets/bezli-logo.png", () => ({ default: "logo.png" }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/hooks/useMyLeague", () => ({
  useMyLeague: () => ({ status: null }),
  showLeagueMenu: () => false,
}));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => 0 }));
vi.mock("@/hooks/useMySchool", () => ({ useMySchool: () => ({ hasSchool: true }) }));
vi.mock("@/hooks/useStaffPermissions", () => ({
  useStaffPermissions: () => ({ isStaff: false, loading: false, permissions: {} }),
}));
vi.mock("@/hooks/useSchoolBranding", () => ({
  useSchoolBranding: () => ({ branding: null }),
}));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolViewSwitcher", () => ({ default: () => null }));
vi.mock("@/components/demo/DemoRoleSwitch", () => ({
  default: () => <button type="button">Přepnout demo roli</button>,
}));
vi.mock("@/lib/preview-student", () => ({
  isPreviewStudentSession: () => false,
  returnFromPreviewStudent: vi.fn(),
  switchToPreviewStudent: vi.fn(),
}));

const openMobileMenu = () => {
  const hamburger = document.querySelector<HTMLButtonElement>('button[aria-label="Menu"]');
  expect(hamburger).not.toBeNull();
  fireEvent.click(hamburger!);
};

const renderHeader = () => render(
  <MemoryRouter initialEntries={["/student"]}>
    <SiteHeader />
  </MemoryRouter>,
);

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  signOut.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
});

describe.each(["user", "teacher", "school_admin", "admin"] as const)(
  "mobilní menu 390 × 844 – role %s",
  (role) => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isLoggedIn: true,
        role,
        realRole: role,
        roles: role === "admin" ? ["admin", "school_admin", "teacher", "user"] : [role],
        viewAsRole: role === "admin" ? "admin" : null,
        canSwitchSchoolView: role === "teacher" || role === "school_admin",
        preferredView: role === "teacher" ? "teacher" : role === "school_admin" ? "school_admin" : null,
        setViewAsRole: vi.fn(),
        setPreferredView: vi.fn(),
        user: { id: "[TEST]mobile-menu" },
        signOut,
      });
    });

    it("oddělí posouvanou navigaci od trvale dosažitelného účtu a zamkne stránku", () => {
      renderHeader();
      openMobileMenu();

      const menu = document.getElementById("mobile-menu");
      const navigation = screen.getByRole("navigation", { name: "Mobilní navigace" });
      const account = screen.getByLabelText("Účet");

      expect(menu).not.toBeNull();
      expect(menu).toHaveStyle({
        maxHeight: "calc(100dvh - 70px - var(--demo-banner-h, 0px))",
      });
      expect(menu).toHaveClass("overflow-y-auto", "overscroll-contain");
      expect(navigation).toHaveClass("min-h-0", "overflow-y-auto", "overscroll-contain");
      expect(navigation.contains(account)).toBe(false);
      expect(account).toHaveClass("sticky", "bottom-0", "shrink-0");
      expect(account).toHaveStyle({ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" });

      expect(within(account).getByRole("button", { name: "Profil" })).toBeVisible();
      expect(within(account).getByRole("button", { name: "Přepnout demo roli" })).toBeVisible();
      expect(within(account).getByRole("button", { name: "Odhlásit" })).toBeVisible();
      if (role !== "user") {
        expect(within(account).getByRole("group", { name: "Přepnout roli" })).toBeVisible();
      }

      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.overflow).toBe("hidden");
      openMobileMenu();
      expect(document.body.style.overflow).not.toBe("hidden");
      expect(document.documentElement.style.overflow).not.toBe("hidden");
    });
  },
);

describe("mobilní menu žáka", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: true,
      role: "user",
      realRole: "user",
      roles: ["user"],
      user: { id: "[TEST]student" },
      signOut,
    });
  });

  it("má doplňkové položky ve výchozím stavu skryté pod Více", () => {
    renderHeader();
    openMobileMenu();

    const more = screen.getByRole("button", { name: "Více" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Učím se" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tahák" })).toBeNull();

    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Učím se", "Portfolio", "Moje knihy", "Můj sešit", "Tahák", "Nápověda"]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }

    openMobileMenu();
    openMobileMenu();
    expect(screen.getByRole("button", { name: "Více" })).toHaveAttribute("aria-expanded", "false");
  });

  it("umožní odhlášení z pevného účtového pruhu", async () => {
    renderHeader();
    openMobileMenu();
    const account = screen.getByLabelText("Účet");
    fireEvent.click(within(account).getByRole("button", { name: "Odhlásit" }));
    expect(signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByLabelText("Účet")).toBeNull());
  });
});
