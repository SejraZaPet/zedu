import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
let demo: any = null;
vi.mock("@/lib/demo", () => ({ useDemoPair: () => demo }));
import { HELP_HINTS, HELP_BODY_MAX, academyHref, getHelpHint, ACADEMY_COURSES } from "@/lib/help-hints";
import { HelpHint } from "@/components/help/HelpHint";

describe("registr nápověd", () => {
  it("každý záznam má krátký text a správnou značku", () => {
    for (const [id, e] of Object.entries(HELP_HINTS)) {
      expect(e.title, id).toBeTruthy();
      expect(e.body.length, id).toBeLessThanOrEqual(HELP_BODY_MAX);
      expect(`${e.title} ${e.body} ${(e as any).when ?? ""}`, id).not.toMatch(/zedu/i);
    }
  });
  it("odkaz do Akademie vede na kurz a modul", () => {
    const e = getHelpHint("live.join")!;
    expect(academyHref(e, { isDemo: false, role: "teacher" })).toMatch(`/ucitel/akademie?kurz=${ACADEMY_COURSES.live}&modul=`);
    expect(academyHref(e, { isDemo: false, role: "student" })).toBeNull();
    expect(academyHref(getHelpHint("demo.limits")!, { isDemo: true, role: "teacher" })).toBeNull();
  });
});

describe("HelpHint", () => {
  it("neznámý klíč nic nevykreslí", () => {
    const { container } = render(<MemoryRouter><HelpHint id="neexistuje" /></MemoryRouter>);
    expect(container.innerHTML).toBe("");
  });
  it("otevře nápovědu s odkazem a Esc ji zavře", () => {
    demo = null;
    render(<MemoryRouter><HelpHint id="live.adaptive" /></MemoryRouter>);
    const btn = screen.getByRole("button", { name: "Nápověda: Adaptivní závěr" });
    fireEvent.click(btn);
    expect(screen.getByRole("dialog")).toHaveTextContent("podíl správných odpovědí");
    expect(screen.getByRole("link", { name: "Zjistit víc v Akademii" })).toHaveAttribute("href", expect.stringContaining("kurz="));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
