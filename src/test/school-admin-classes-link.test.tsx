import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    role: "school_admin",
    realRole: "school_admin",
    status: "approved",
    loading: false,
    signOut: vi.fn(),
  }),
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const fx = vi.hoisted(() => ({
  school: { id: "sch-1", name: "Testovací škola", registration_code: "ABC123" },
  member: { id: "u2", email: "zak@example.test", first_name: "Jan", last_name: "Novák", status: "approved" },
}));

vi.mock("@/integrations/supabase/client", () => {
  const singleData: Record<string, unknown> = {
    profiles: { school_id: fx.school.id },
    schools: fx.school,
  };
  const listData: Record<string, unknown[]> = {
    profiles: [fx.member],
    user_roles: [{ user_id: "u2", role: "user" }],
  };
  const makeQuery = (table: string): any => {
    const q: any = {};
    ["select", "order", "eq", "in", "is", "neq", "limit"].forEach((m) => { q[m] = vi.fn(() => q); });
    q.single = vi.fn(() => Promise.resolve({ data: singleData[table] ?? null, error: null }));
    q.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    q.then = (onF: any, onR?: any) =>
      Promise.resolve({ data: listData[table] ?? [], error: null }).then(onF, onR);
    return q;
  };
  return { supabase: { from: vi.fn((t: string) => makeQuery(t)), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } };
});

// Vedlejší panely stránky nejsou pro tento test potřeba.
vi.mock("@/components/dashboard/DashboardBanners", () => ({ default: () => null }));
vi.mock("@/components/dashboard/BannersNewsButton", () => ({ default: () => null }));
vi.mock("@/components/banners/BannerManager", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolViewSwitcher", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolLeagueCard", () => ({ SchoolLeagueCard: () => null }));
vi.mock("@/components/school/SchoolBrandingSection", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolBulkImportCard", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolCreatorSalesCard", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolLeadershipCard", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolLicenseCard", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolResourcesManager", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolCurriculumManager", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolOverviewTab", () => ({ default: () => null }));
vi.mock("@/components/school/SchoolEngagementTab", () => ({ default: () => null }));

import SchoolAdmin from "@/pages/SchoolAdmin";

describe("Správa školy – odkaz na Třídy", () => {
  it("v hlavičce je tlačítko Třídy vedoucí na seznam tříd", async () => {
    render(
      <MemoryRouter initialEntries={["/skola"]}>
        <SchoolAdmin />
      </MemoryRouter>,
    );
    const link = await screen.findByRole("link", { name: /Třídy/ });
    expect(link).toHaveAttribute("href", "/ucitel/tridy");
  });
});
