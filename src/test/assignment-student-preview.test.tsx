import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const writes = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = new Proxy({}, {
    get: (_t, key) => {
      if (["insert", "update", "upsert", "delete"].includes(String(key))) return (...a: unknown[]) => { writes(String(key), a); return chain; };
      if (key === "then") return undefined;
      if (key === "maybeSingle") return () => Promise.resolve({ data: null, error: null });
      return () => chain;
    },
  });
  return { supabase: { from: () => chain, storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://x/y" } }) }) } } };
});

import AssignmentStudentPreview, { previewExcerpt } from "@/components/assignments/AssignmentStudentPreview";

const long = "<p>" + "Popis úkolu ".repeat(30) + "KONEC</p>";
const assignment = {
  id: "a1", title: "[TEST] Úkol", description: long, deadline: null,
  materials: [{ id: "m1", kind: "link", title: "Odkaz na zdroj", url: "https://example.org" }],
  worksheet_id: "w1",
};

describe("Náhled zadání", () => {
  beforeEach(() => writes.mockClear());

  it("zkrátí dlouhý popis", () => {
    const e = previewExcerpt(long);
    expect(e.truncated).toBe(true);
    expect(e.text.endsWith("…")).toBe(true);
  });

  it("výchozí zavřený stav, rozbalení ukáže celé zadání a materiály, nic se nezapíše", () => {
    render(<MemoryRouter><AssignmentStudentPreview assignment={assignment} open onOpenChange={() => {}} /></MemoryRouter>);
    expect(screen.queryByText(/KONEC/)).toBeNull();
    expect(screen.queryByText("Odkaz na zdroj")).toBeNull();
    expect(screen.getByRole("link", { name: /Pracovní list/ })).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "Zobrazit celé zadání" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByText(/KONEC/)).toBeTruthy();
    expect(screen.getByText("Odkaz na zdroj")).toBeTruthy();
    expect(writes).not.toHaveBeenCalled();
  });
});
