import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Hero from "@/components/Hero";
import {
  DEFAULT_FINAL_CTA_PROPS,
  DEFAULT_HERO_PROPS,
  DEFAULT_HOW_IT_WORKS_PROPS,
} from "@/lib/landing-defaults";

const navigate = vi.fn();
const startDemo = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("@/lib/demo", () => ({
  startDemo: (...args: unknown[]) => startDemo(...args),
  dashboardFor: (role: "teacher" | "student") => role === "teacher" ? "/ucitel" : "/student",
}));
vi.mock("@/components/landing/IntroPricingBanner", () => ({ default: () => null }));
vi.mock("@/assets/hero-students.png", () => ({ default: "hero.png" }));
vi.mock("@/assets/bezli-logo.png", () => ({ default: "logo.png" }));

const renderHero = (props?: Parameters<typeof Hero>[0]["props"], entry = "/") =>
  render(<MemoryRouter initialEntries={[entry]}><Hero props={props} /></MemoryRouter>);

beforeEach(() => {
  navigate.mockReset();
  startDemo.mockReset();
  startDemo.mockReturnValue(new Promise(() => {}));
});

describe("hlavní CTA Vyzkoušet zdarma", () => {
  it("výchozí odkaz nevede na /auth a spustí učitelské demo s načítáním", () => {
    expect(DEFAULT_HERO_PROPS.primary_cta.href).not.toBe("/auth");
    renderHero();

    fireEvent.click(screen.getByRole("button", { name: "Vyzkoušet zdarma" }));

    expect(startDemo).toHaveBeenCalledWith("teacher", null);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Připravuji demo…" })).toBeDisabled();
  });

  it("existující CMS hodnotu /auth u tohoto CTA rozpozná jako demo a předá event_tag", () => {
    renderHero({
      primary_cta: { label: "Vyzkoušet zdarma", href: "/auth", icon: "Rocket" },
    }, "/?akce=dalkove-ucitele");

    fireEvent.click(screen.getByRole("button", { name: "Vyzkoušet zdarma" }));

    expect(startDemo).toHaveBeenCalledWith("teacher", "dalkove-ucitele");
    expect(navigate).not.toHaveBeenCalledWith("/auth");
  });

  it("při chybě zobrazí českou hlášku a nabídne vytvoření účtu", async () => {
    startDemo.mockRejectedValueOnce(new Error("Dnešní kapacita dem je vyčerpaná. Zkuste to prosím zítra."));
    renderHero();

    fireEvent.click(screen.getByRole("button", { name: "Vyzkoušet zdarma" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Dnešní kapacita dem je vyčerpaná. Zkuste to prosím zítra.");
    expect(screen.getByRole("button", { name: "Vyzkoušet zdarma" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Vytvořit účet" }));
    expect(navigate).toHaveBeenCalledWith("/auth?role=teacher");
  });

  it("samostatné přihlášení a registrační CTA nemění", () => {
    expect(DEFAULT_HOW_IT_WORKS_PROPS.cta.href).toBe("/auth");
    expect(DEFAULT_FINAL_CTA_PROPS.primary_cta.href).toBe("/auth");
    renderHero({ primary_cta: { label: "Přihlásit se", href: "/auth", icon: "Rocket" } });

    fireEvent.click(screen.getByRole("button", { name: "Přihlásit se" }));

    expect(navigate).toHaveBeenCalledWith("/auth");
    expect(startDemo).not.toHaveBeenCalled();
  });
});
