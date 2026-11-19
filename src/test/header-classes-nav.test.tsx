import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({ role: "admin", roles: ["admin"] as string[] }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    role: state.role,
    roles: state.roles,
    signOut: vi.fn(),
    user: { id: "u1" },
  }),
}));
vi.mock("@/hooks/useMyLeague", () => ({ useMyLeague: () => ({ status: null }), showLeagueMenu: () => false }));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => 0 }));
vi.mock("@/hooks/useStaffPermissions", () => ({
  useStaffPermissions: () => ({ isStaff: false, permissions: [] }),
  hasStaffPermission: vi.fn(() => false),
}));
vi.mock("@/hooks/useSchoolBranding", () => ({ useSchoolBranding: () => ({ branding: null }) }));
vi.mock("@/hooks/useMySchool", () => ({
  useMySchool: () => ({ hasSchool: false, schoolId: null, schoolName: null }),
}));
vi.mock("@/components/notifications/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolViewSwitcher", () => ({ default: () => null }));
vi.mock("@/components/demo/DemoRoleSwitch", () => ({ default: () => null }));
vi.mock("@/components/RoleSwitchMenu", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => ({})) } }));

import SiteHeader from "@/components/SiteHeader";

const Probe = () => {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
};

const navTitles = () =>
  Array.from(document.querySelectorAll("nav button")).map((b) => b.getAttribute("title"));

const renderHeader = () =>
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <SiteHeader />
      <Probe />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.role = "admin";
  state.roles = ["admin"];
});

describe("horní lišta – položka Třídy", () => {
  it("admin ji vidí před Nápovědou a kliknutím se dostane na seznam tříd", () => {
    renderHeader();
    expect(navTitles()).toEqual(["Přehled", "Uživatelé", "Třídy", "Nápověda"]);
    fireEvent.click(screen.getByRole("button", { name: "Třídy" }));
    expect(screen.getByTestId("loc")).toHaveTextContent("/ucitel/tridy");
  });

  it("admin se školou má Třídy za Správou školy", () => {
    state.roles = ["admin", "school_admin"];
    renderHeader();
    expect(navTitles()).toEqual(["Přehled", "Uživatelé", "Správa školy", "Třídy", "Nápověda"]);
  });

  it("school_admin ji vidí za Správou školy", () => {
    state.role = "school_admin";
    state.roles = ["school_admin"];
    renderHeader();
    expect(navTitles()).toEqual(["Správa školy", "Třídy", "Nápověda"]);
    fireEvent.click(screen.getByRole("button", { name: "Třídy" }));
    expect(screen.getByTestId("loc")).toHaveTextContent("/ucitel/tridy");
  });

  it("učitel ji má pořád", () => {
    state.role = "teacher";
    state.roles = ["teacher"];
    renderHeader();
    expect(navTitles()).toContain("Třídy");
  });
});
