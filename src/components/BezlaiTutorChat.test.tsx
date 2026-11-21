import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BezlaiTutorChat from "./BezlaiTutorChat";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe("Bezlai tutor – režimy", () => {
  afterEach(() => { cleanup(); invoke.mockReset(); });

  it("volný režim odhalí AI, nevnucuje poslední lekci a pošle mode free", async () => {
    invoke.mockResolvedValue({ data: { reply: "Podívejme se na to spolu." }, error: null });
    render(<BezlaiTutorChat mode="free" question="" open hideTrigger />);
    expect(screen.getByText(/jsem Bezlai, umělá inteligence/)).toBeInTheDocument();
    expect(screen.getByText("S čím ti pomůžu?")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Na co se chceš zeptat?"), { target: { value: "Co je hovězí maso?" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    expect(await screen.findByText("Podívejme se na to spolu.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("ask-zedai-tutor", {
      body: expect.objectContaining({ mode: "free", question: "", studentMessage: "Co je hovězí maso?" }),
    });
    const body = invoke.mock.calls[0][1].body;
    expect(body.conversationHistory).toEqual([]);
  });

  it("kontextový režim zůstane výchozí a nezmění sokratovský úvod", async () => {
    invoke.mockResolvedValue({ data: { reply: "Co víš o zadání?" }, error: null });
    render(<BezlaiTutorChat question="Vypočítej 2 + 2" open hideTrigger />);
    expect(screen.getByText("Čeho se zadání týká, čemu nerozumíš?")).toBeInTheDocument();
    expect(screen.getByText(/Neřeknu ti přímo odpověď/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Napiš, čemu nerozumíš…"), { target: { value: "Nevím" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    expect(await screen.findByText("Co víš o zadání?")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("ask-zedai-tutor", {
      body: expect.objectContaining({ mode: "context", question: "Vypočítej 2 + 2" }),
    });
  });

  it("chyba vyhledávání je čitelná a odpověď se stále zobrazí", async () => {
    invoke.mockResolvedValue({ data: { reply: "Obecné vysvětlení.", searchError: "Materiály se nepodařilo prohledat. Odpovím bez nich." }, error: null });
    render(<BezlaiTutorChat mode="free" question="" open hideTrigger />);
    fireEvent.change(screen.getByPlaceholderText("Na co se chceš zeptat?"), { target: { value: "Dotaz" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    expect(await screen.findByText("Obecné vysvětlení.")).toBeInTheDocument();
    expect(screen.getByText(/Materiály se nepodařilo prohledat/)).toBeInTheDocument();
  });
});
