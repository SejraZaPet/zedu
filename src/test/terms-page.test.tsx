import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import MarkdownDocument from "@/components/legal/MarkdownDocument";
import { parseMarkdown, safeHref, slugify } from "@/lib/simple-markdown";

vi.mock("@/components/SiteHeader", () => ({ default: () => <header /> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, role: null, loading: false }) }));

const MD = `## Úvodní ustanovení\n\nText **tučně**.\n\n## Ceník\n\n| Balíček | Cena |\n|---|---|\n| Plus | 100 Kč |\n\n- jedna\n- dvě`;

describe("obchodní podmínky", () => {
  it("nadpisy ## mají kotvy a obsah na ně odkazuje", () => {
    render(<MarkdownDocument source={MD} />);
    expect(document.getElementById("uvodni-ustanoveni")?.tagName).toBe("H2");
    const nav = screen.getByRole("navigation", { name: "Obsah" });
    expect(nav.querySelector('a[href="#cenik"]')).not.toBeNull();
    expect(screen.getByText("tučně").tagName).toBe("STRONG");
  });
  it("tabulka je ve vlastním posuvném obalu, stránka nepřetéká", () => {
    render(<MarkdownDocument source={MD} />);
    const wrap = screen.getByTestId("legal-table-wrap");
    expect(wrap.className).toContain("overflow-x-auto");
    expect(wrap.className).toContain("max-w-full");
    expect(wrap.querySelector("table")).not.toBeNull();
  });
  it("parser: duplicitní kotvy, seznam, bezpečné odkazy", () => {
    const b = parseMarkdown("## A\n## A\n1. x\n2. y");
    expect(b.map((x) => (x.type === "heading" ? x.id : x.type))).toEqual(["a", "a-2", "list"]);
    expect(slugify("Článek 7 – Demo")).toBe("clanek-7-demo");
    expect(safeHref("javascript:alert(1)")).toBe("#");
  });
  it("stránka /podminky se vykreslí s nadpisem a textem", async () => {
    const { default: TermsPage } = await import("@/pages/TermsPage");
    render(<HelmetProvider><MemoryRouter><TermsPage /></MemoryRouter></HelmetProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "Všeobecné obchodní podmínky" })).toBeTruthy();
    expect(screen.getByText(/bude doplněn/)).toBeTruthy();
  });
  it("patička odkazuje na Obchodní podmínky", async () => {
    const { default: SiteFooter } = await import("@/components/SiteFooter");
    render(<MemoryRouter><SiteFooter /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Obchodní podmínky" })).toBeTruthy();
    expect(screen.getByText("Cookies")).toBeTruthy();
  });
});
