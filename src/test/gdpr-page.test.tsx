import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

vi.mock("@/components/SiteHeader", () => ({ default: () => <header /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <footer /> }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, role: null, loading: false }),
}));

/** Všech 10 bodů znění z 19. 11. 2026 – každý musí zůstat samostatný. */
const HEADINGS = [
  "1. Kdo údaje zpracovává",
  "2. Jaké údaje a proč",
  "3. Co neděláme",
  "4. Komu údaje předáváme",
  "5. Jak dlouho údaje uchováváme",
  "6. Vaše práva",
  "7. Děti",
  "8. Umělá inteligence",
  "9. Povinnost poskytnout údaje",
  "10. Cookies a místní úložiště",
];

const open = async () => {
  const { default: GdprPage } = await import("@/pages/GdprPage");
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <GdprPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
};

describe("stránka /gdpr", () => {
  it("má nadpis Zásady ochrany osobních údajů a všech 10 bodů", async () => {
    const { container } = await open();
    expect(screen.getByRole("heading", { level: 1, name: "Zásady ochrany osobních údajů" })).toBeTruthy();
    for (const h of HEADINGS) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeTruthy();
    }
    expect(container.querySelectorAll("main h2")).toHaveLength(10);
  });

  it("obsahuje datum aktualizace, klikací odkazy a žádnou pracovní hlášku", async () => {
    const { container } = await open();
    expect(container.textContent).toContain("Poslední aktualizace: 19. listopadu 2026");
    expect(container.querySelector('a[href="/podminky"]')).not.toBeNull();
    expect(container.querySelector('a[href="mailto:info@bezli.cz"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Tento dokument je připravován");
    expect(container.textContent).not.toContain("po právní konzultaci");
  });

  it("neobsahuje staré odrážkové seznamy údajů", async () => {
    const { container } = await open();
    expect(container.querySelectorAll("main ul")).toHaveLength(0);
    expect(container.textContent).not.toContain("Jméno a příjmení");
  });
  it("bod 10 má id cookies a přesné znění", async () => {
    const { default: GdprPage } = await import("@/pages/GdprPage");
    const { container } = render(<HelmetProvider><MemoryRouter><GdprPage /></MemoryRouter></HelmetProvider>);
    expect(container.querySelector("h2#cookies")?.textContent).toBe("10. Cookies a místní úložiště");
    expect(container.textContent?.replace(/\s+/g, " ")).toContain("Používáme jen technické cookies a místní úložiště prohlížeče nezbytné pro fungování služby (přihlášení, nastavení vzhledu a přístupnosti, stav panelů). Ty nevyžadují souhlas. Nepoužíváme reklamní ani sledovací cookies. Návštěvnost měříme anonymně vestavěným měřením hostingu, bez cookies a bez ukládání IP adres (zobrazené stránky, země, typ zařízení); podrobné údaje se uchovávají 90 dnů, souhrny jeden rok. Vložený obsah třetích stran (například videa) může po spuštění nastavovat vlastní cookies.");
  });
});
