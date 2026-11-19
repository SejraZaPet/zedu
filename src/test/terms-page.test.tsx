import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import MarkdownDocument from "@/components/legal/MarkdownDocument";
import termsSource from "@/content/obchodni-podminky.md?raw";
import { parseMarkdown, safeHref, slugify } from "@/lib/simple-markdown";

vi.mock("@/components/SiteHeader", () => ({ default: () => <header /> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, role: null, loading: false }) }));

const MD = `# Všeobecné obchodní podmínky služby Bezli\n\n## Úvodní ustanovení\n\nText **tučně**.\n\n## Ceník\n\n| Balíček | Cena |\n|---|---|\n| Plus | 100 Kč |\n\n- jedna\n- dvě`;

describe("obchodní podmínky", () => {
  it("vykreslí H1, H2, tučný text, odrážky a obsah s kotvami", () => {
    render(<MarkdownDocument source={MD} />);
    expect(screen.getByRole("heading", { level: 1, name: "Všeobecné obchodní podmínky služby Bezli" })).toBeTruthy();
    expect(document.getElementById("uvodni-ustanoveni")?.tagName).toBe("H2");
    const nav = screen.getByRole("navigation", { name: "Obsah" });
    expect(nav.querySelector('a[href="#cenik"]')).not.toBeNull();
    expect(screen.getByText("tučně").tagName).toBe("STRONG");
    expect(screen.getByText("jedna").closest("ul")?.querySelectorAll("li")).toHaveLength(2);
  });

  it("tabulka má hlavičku, řádek a vlastní vodorovně posuvný obal", () => {
    render(<MarkdownDocument source={MD} />);
    const wrap = screen.getByTestId("legal-table-wrap");
    expect(wrap.className).toContain("overflow-x-auto");
    expect(wrap.className).toContain("max-w-full");
    expect(wrap.querySelector("table")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Balíček" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "100 Kč" })).toBeTruthy();
  });

  it("podtržítka ve formuláři zůstanou prostým textem", () => {
    render(<MarkdownDocument source={"Datum: ______ · Podpis: ______"} />);
    const paragraph = screen.getByText("Datum: ______ · Podpis: ______");
    expect(paragraph.querySelector("strong, em, i")).toBeNull();
  });

  it("parser: duplicitní kotvy, seznam, bezpečné odkazy", () => {
    const b = parseMarkdown("## A\n## A\n1. x\n2. y");
    expect(b.map((x) => (x.type === "heading" ? x.id : x.type))).toEqual(["a", "a-2", "list"]);
    expect(slugify("Článek 7 – Demo")).toBe("clanek-7-demo");
    expect(safeHref("javascript:alert(1)")).toBe("#");
  });

  it("stránka /podminky obsahuje celé schválené znění bez pracovních poznámek", async () => {
    const { default: TermsPage } = await import("@/pages/TermsPage");
    const { container } = render(<HelmetProvider><MemoryRouter><TermsPage /></MemoryRouter></HelmetProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "Všeobecné obchodní podmínky služby Bezli" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Příloha 2: Zpracovatelská smlouva (čl. 28 GDPR)" })).toBeTruthy();
    expect(screen.getAllByText(/90 dnů/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("Poznámky pro Tynu");
    expect(container.textContent).not.toContain("[takto]");
    expect(container.textContent).not.toContain("bude doplněn");
    expect(container.querySelector("main")?.className).toContain("print-area");
  });

  it("patička odkazuje na Obchodní podmínky", async () => {
    const { default: SiteFooter } = await import("@/components/SiteFooter");
    render(<MemoryRouter><SiteFooter /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Obchodní podmínky" })).toBeTruthy();
    expect(screen.getByText("Cookies")).toBeTruthy();
  });
});
