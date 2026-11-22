import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Index from "@/pages/Index";

const mocks = vi.hoisted(() => ({
  realRole: "admin" as string | null,
  authLoading: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ realRole: mocks.realRole, loading: mocks.authLoading }),
}));

vi.mock("@/hooks/useLandingSections", async (original) => ({
  ...(await original<typeof import("@/hooks/useLandingSections")>()),
  useLandingSections: () => ({ data: [], isLoading: false, isError: false }),
  useAllLandingSections: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/components/SiteHeader", () => ({ default: () => <div>Veřejná úvodní stránka</div> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => null }));
vi.mock("@/components/Seo", () => ({ default: () => null }));
vi.mock("@/components/Hero", () => ({ default: () => null }));
vi.mock("@/components/landing/SocialProof", () => ({ default: () => null }));
vi.mock("@/components/landing/FeaturesGrid", () => ({ default: () => null }));
vi.mock("@/components/landing/HowItWorks", () => ({ default: () => null }));
vi.mock("@/components/landing/ForWhom", () => ({ default: () => null }));
vi.mock("@/components/landing/PlatformShowcase", () => ({ default: () => null }));
vi.mock("@/components/PodcastSection", () => ({ default: () => null }));
vi.mock("@/components/landing/FinalCTA", () => ({ default: () => null }));
vi.mock("@/components/LicensePlansSection", () => ({ default: () => null }));
vi.mock("@/components/landing/PwaInstallSection", () => ({ default: () => null }));
vi.mock("@/components/landing-edit/EditableSectionWrapper", () => ({
  default: ({ children }: { children: import("react").ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/landing-edit/SortableSection", () => ({
  default: ({ children }: { children: import("react").ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/landing-edit/InsertSectionSlot", () => ({ default: () => null }));
vi.mock("@/components/landing-edit/LandingEditSidePanel", () => ({ default: () => null }));
vi.mock("@/components/admin/landing/AddSectionDialog", () => ({ AddSectionDialog: () => null }));

function renderPage(entry: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<div>Administrace úvodní stránky</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.realRole = "admin";
  mocks.authLoading = false;
});

describe("vstup do editace úvodní stránky", () => {
  it("na veřejné adrese nezobrazí adminovi tlačítko ani editační režim", async () => {
    renderPage("/");

    await screen.findByText("Veřejná úvodní stránka");
    expect(screen.queryByRole("button", { name: "Upravit stránku" })).not.toBeInTheDocument();
    expect(screen.queryByText("Režim úprav")).not.toBeInTheDocument();
  });

  it("admin vstoupí z odkazu administrace a může se vrátit", async () => {
    renderPage("/?edit=1&from=admin");

    await screen.findByText("Režim úprav");
    fireEvent.click(screen.getByRole("button", { name: "Ukončit a zpět do administrace" }));

    expect(await screen.findByText("Administrace úvodní stránky")).toBeInTheDocument();
    expect(screen.queryByText("Režim úprav")).not.toBeInTheDocument();
  });

  it.each(["teacher", null])("parametr editace nepovolí roli %s", async (role) => {
    mocks.realRole = role;
    renderPage("/?edit=1&from=admin");

    await screen.findByText("Veřejná úvodní stránka");
    expect(screen.queryByRole("button", { name: "Upravit stránku" })).not.toBeInTheDocument();
    expect(screen.queryByText("Režim úprav")).not.toBeInTheDocument();
  });
});
