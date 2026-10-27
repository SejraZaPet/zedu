import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "stu-1" } }) }));

import PortfolioSourceActions from "@/components/portfolio/PortfolioSourceActions";
import { portfolioAssignmentId, portfolioWorksheetHref, type PortfolioItem } from "@/lib/portfolio";

const base: PortfolioItem = {
  id: "i1", student_id: "stu-1", type: "worksheet_result", title: "[TEST] List", description: null,
  subject: null, attachment_url: null, content_json: {}, created_at: "2026-10-01T00:00:00Z",
};
const r = (item: PortfolioItem) => render(<MemoryRouter><PortfolioSourceActions item={item} /></MemoryRouter>);

describe("portfolio – otevření zdroje", () => {
  it("položka z úkolu nabídne Zobrazit odevzdání", () => {
    r({ ...base, source_assignment_id: "a1" });
    expect(screen.getByRole("button", { name: /Zobrazit odevzdání/ })).toBeInTheDocument();
  });
  it("assignment_id z content_json (syntetická položka) funguje taky", () => {
    expect(portfolioAssignmentId({ ...base, content_json: { assignment_id: "a2" } })).toBe("a2");
  });
  it("bez zdroje se nic nezobrazí", () => {
    const { container } = r(base);
    expect(container).toBeEmptyDOMElement();
  });
  it("odkaz na list jen interní a jen pro žáka-vlastníka", () => {
    r({ ...base, content_json: { href: "/student/pracovni-list/w1" } });
    expect(screen.getByRole("link", { name: /Otevřít list/ })).toHaveAttribute("href", "/student/pracovni-list/w1");
    expect(portfolioWorksheetHref({ ...base, content_json: { href: "https://evil.example" } })).toBeNull();
  });
  it("učitel odkaz na žákovský list nevidí", () => {
    const { container } = r({ ...base, student_id: "other", content_json: { href: "/student/pracovni-list/w1" } });
    expect(container).toBeEmptyDOMElement();
  });
});
