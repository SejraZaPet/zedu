import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";

vi.mock("@/assets/bezli-logo.png", () => ({ default: "logo.png" }));
vi.mock("@/hooks/useSchoolBranding", () => ({ useSchoolBranding: () => ({ branding: null }) }));
vi.mock("@/hooks/useMySchool", () => ({ useMySchool: () => ({ hasSchool: false }) }));
vi.mock("@/hooks/useStaffPermissions", () => ({
  useStaffPermissions: () => ({ isStaff: false, loading: false, permissions: {} }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/components/notifications/NotificationBell", async () => {
  const React = await import("react");
  return {
    default: ({ touch, onUnreadChange }: { touch?: boolean; onUnreadChange?: (n: number) => void }) => {
      React.useEffect(() => { onUnreadChange?.(3); }, [onUnreadChange]);
      return <button data-testid="notification-bell" data-touch={touch ? "1" : "0"} aria-label="Upozornění" />;
    },
  };
});
vi.mock("@/components/school/SchoolViewSwitcher", () => ({ default: () => null }));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

const Probe = () => <div data-testid="location">{useLocation().pathname}</div>;
const renderHeader = () =>
  render(
    <MemoryRouter initialEntries={["/ucitel"]}>
      <SiteHeader />
      <Routes><Route path="*" element={<Probe />} /></Routes>
    </MemoryRouter>,
  );

const auth = (isLoggedIn: boolean, role: string | null) => ({
  isLoggedIn, role, roles: role ? [role] : [], signOut: vi.fn(),
  user: isLoggedIn ? { id: "u1" } : null, loading: false,
});

describe("mobilní hlavička – zvoneček", () => {
  beforeEach(() => mockUseAuth.mockReset());

  for (const role of ["teacher", "user", "school_admin", "admin"]) {
    it(`přihlášený (${role}) vidí jeden dotykový zvoneček vlevo od hamburgeru`, () => {
      mockUseAuth.mockReturnValue(auth(true, role));
      renderHeader();
      const bells = screen.getAllByTestId("notification-bell");
      expect(bells).toHaveLength(1);
      expect(bells[0].dataset.touch).toBe("1");
      const hamburger = document.querySelector('button[aria-label="Menu"]')!;
      expect(bells[0].compareDocumentPosition(hamburger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  }

  it("nepřihlášený zvoneček nevidí", () => {
    mockUseAuth.mockReturnValue(auth(false, null));
    renderHeader();
    expect(screen.queryByTestId("notification-bell")).toBeNull();
  });

  it("mobilní menu má řádek Upozornění s počtem a vede na /notifikace", () => {
    mockUseAuth.mockReturnValue(auth(true, "teacher"));
    renderHeader();
    fireEvent.click(document.querySelector('button[aria-label="Menu"]')!);
    const row = screen.getAllByRole("button", { name: /Upozornění/ }).find((b) => b.className.includes("w-full"))!;
    expect(row.textContent).toContain("3");
    fireEvent.click(row);
    expect(screen.getByTestId("location").textContent).toBe("/notifikace");
  });
});

describe("mobilní hlavička – ikona Zprávy", () => {
  beforeEach(() => mockUseAuth.mockReset());

  it("přihlášený má pořadí Zprávy, zvoneček, hamburger a ikona vede na /zpravy", () => {
    mockUseAuth.mockReturnValue(auth(true, "teacher"));
    renderHeader();
    const msg = screen.getByTestId("mobile-messages-icon");
    const bell = screen.getByTestId("notification-bell");
    const hamburger = document.querySelector('button[aria-label="Menu"]')!;
    expect(msg.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bell.compareDocumentPosition(hamburger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(msg.className).toContain("h-11");
    expect(msg.className).toContain("w-11");
    fireEvent.click(msg);
    expect(screen.getByTestId("location").textContent).toBe("/zpravy");
  });

  it("nepřihlášený ikonu Zprávy nevidí", () => {
    mockUseAuth.mockReturnValue(auth(false, null));
    renderHeader();
    expect(screen.queryByTestId("mobile-messages-icon")).toBeNull();
  });
});
