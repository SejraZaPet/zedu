import { describe, expect, it, vi } from "vitest";

const manualRows = [
  {
    id: "b",
    student_id: "student",
    type: "upload",
    title: "Pozdější ID",
    description: null,
    subject: null,
    attachment_url: null,
    content_json: {},
    created_at: "2026-11-10T10:00:00Z",
  },
  {
    id: "old",
    student_id: "student",
    type: "upload",
    title: "Starší",
    description: null,
    subject: null,
    attachment_url: null,
    content_json: {},
    created_at: "2026-11-01T10:00:00Z",
  },
  {
    id: "a",
    student_id: "student",
    type: "upload",
    title: "Dřívější ID",
    description: null,
    subject: null,
    attachment_url: null,
    content_json: {},
    created_at: "2026-11-10T10:00:00Z",
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const data = table === "student_portfolio_items" ? manualRows : [];
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        not: () => builder,
        in: () => builder,
        order: () => builder,
        filter: () => builder,
        limit: () => builder,
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      return builder;
    },
  },
}));

import { loadFullPortfolio } from "@/lib/portfolio";

describe("portfolio date order", () => {
  it("shows newest items first and resolves equal dates by id", async () => {
    const items = await loadFullPortfolio("student");
    expect(items.map((item) => item.id)).toEqual(["a", "b", "old"]);
  });
});
