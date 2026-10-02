import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";

vi.mock("@/assets/bezli-logo.png", () => ({ default: "logo.png" }));
vi.mock("@/hooks/useSchoolBranding", () => ({
  useSchoolBranding: () => ({ branding: null }),
}));
vi.mock("@/hooks/useMySchool", () => ({
  useMySchool: () => ({ hasSchool: false }),
}));
vi.mock("@/hooks/useStaffPermissions", () => ({
  useStaffPermissions: () => ({ isStaff: false, loading: false, permissions: {} }),
}));
vi.mock("@/components/notifications/NotificationBell", () => ({
  default: () => <div data-testid="notification-bell" />,
}));
vi.mock("@/components/school/SchoolViewSwitcher", () => ({
  default: () => <div data-testid="school-view-switcher" />,
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderHeader = () =>
  render(
    <MemoryRouter initialEntries={["/student"]}>
      <SiteHeader />
      <Routes>
        <Route path="/zpravy" element={<LocationProbe />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const openMobileMenu = () => {
  // Hamburger má aria-label "Menu", desktopový dropdown má jen text "Menu".
  const hamburger = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Menu"]',
  );
  expect(hamburger).not.toBeNull();
  fireEvent.click(hamburger!);
};

// Desktop má ikonku s aria-label "Zprávy", mobilní položka je tlačítko s textem.
const getMobileMessagesButton = () => {
  const candidates = screen
    .getAllByRole("button", { name: /Zprávy/ })
    .filter((b) => b.className.includes("w-full"));
  expect(candidates).toHaveLength(1);
  return candidates[0];
};

describe.each(["user", "teacher", "rodic"] as const)(
  "mobilní menu – Zprávy (role %s)",
  (role) => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isLoggedIn: true,
        role,
        roles: [role],
        realRole: role,
        user: { id: "test-user" },
        loading: false,
        signOut: vi.fn(),
      });
    });

    it("zobrazí položku Zprávy a vede na /zpravy", () => {
      renderHeader();
      openMobileMenu();
      const messages = getMobileMessagesButton();
      expect(messages).toBeVisible();
      fireEvent.click(messages);
      expect(screen.getByTestId("location")).toHaveTextContent("/zpravy");
    });
  },
);

describe("mobilní menu – nepřihlášený", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: false,
      role: null,
      roles: [],
      realRole: null,
      user: null,
      loading: false,
      signOut: vi.fn(),
    });
  });

  it("nezobrazí Zprávy", () => {
    renderHeader();
    openMobileMenu();
    expect(screen.queryByRole("button", { name: /Zprávy/ })).toBeNull();
  });
});
