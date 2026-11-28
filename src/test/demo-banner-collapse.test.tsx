import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DemoBanner from "@/components/demo/DemoBanner";
import { DEMO_BANNER_COLLAPSED_KEY, DEMO_LIMIT_EVENT, isDemoAiLimitBody, mustStayExpanded } from "@/lib/demo-limits";

const mocks = vi.hoisted(() => ({
  status: null as any,
  limits: [] as any[],
}));
vi.mock("@/lib/demo", () => ({ useDemoPair: () => ({ side: "teacher", returnCode: "TEST-CODE" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "demo-teacher" } }) }));
vi.mock("@/lib/demo-contact-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo-contact-client")>()),
  useDemoStatus: () => ({ status: mocks.status, reload: vi.fn() }),
  hasOwnDemoContent: () => Promise.resolve(false),
}));
vi.mock("@/lib/demo-limits", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo-limits")>()),
  useDemoLimits: () => ({ limits: mocks.limits, reload: vi.fn() }),
}));
vi.mock("@/components/demo/DemoSaveWorkDialog", () => ({ default: () => null }));
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;

const view = () => render(<MemoryRouter><DemoBanner /></MemoryRouter>);
const status = (daysLeft: number) => ({ hasContact: true, deletesAt: "2026-12-05T23:00:00Z", daysLeft, extended: false, emailMasked: null });

beforeEach(() => {
  window.localStorage.clear();
  mocks.status = status(14);
  mocks.limits = [{ key: "ai", label: "AI generování", used: 2, limit: 5 }];
});

describe("demo pruh – sbalení a limity", () => {
  it("sbalí se, zapamatuje stav a znovu rozbalí s ARIA", () => {
    view();
    const hide = screen.getByRole("button", { name: "Skrýt pruh dema" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(hide);
    expect(window.localStorage.getItem(DEMO_BANNER_COLLAPSED_KEY)).toBe("1");
    expect(screen.queryByText(/DEMO/)).not.toBeInTheDocument();
    const show = screen.getByRole("button", { name: /Zobrazit pruh dema/ });
    expect(show).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(show);
    expect(window.localStorage.getItem(DEMO_BANNER_COLLAPSED_KEY)).toBeNull();
    expect(screen.getByText(/DEMO/)).toBeInTheDocument();
  });

  it("uložený sbalený stav se po načtení obnoví", () => {
    window.localStorage.setItem(DEMO_BANNER_COLLAPSED_KEY, "1");
    view();
    expect(screen.getByRole("region", { name: "Demo" })).toHaveAttribute("data-collapsed", "true");
  });

  it("při smazání za ≤ 3 dny je rozbalený a nejde skrýt", () => {
    window.localStorage.setItem(DEMO_BANNER_COLLAPSED_KEY, "1");
    mocks.status = status(3);
    view();
    expect(screen.getByText(/DEMO/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skrýt pruh dema" })).not.toBeInTheDocument();
    expect(mustStayExpanded(0, false)).toBe(true);
    expect(mustStayExpanded(4, false)).toBe(false);
  });

  it("ukáže čip se zbývajícím AI", () => {
    view();
    expect(screen.getByText("AI generování: zbývají 3 z 5")).toHaveAttribute("data-exhausted", "false");
  });

  it("vyčerpaný limit: červený čip, hláška a vynucené rozbalení", () => {
    window.localStorage.setItem(DEMO_BANNER_COLLAPSED_KEY, "1");
    mocks.limits = [{ key: "ai", label: "AI generování", used: 5, limit: 5 }];
    view();
    expect(screen.getByText("AI generování: zbývají 0 z 5")).toHaveAttribute("data-exhausted", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("AI generování je vyčerpané");
  });

  it("událost 429 z AI rozbalí pruh a ukáže hlášku", () => {
    window.localStorage.setItem(DEMO_BANNER_COLLAPSED_KEY, "1");
    view();
    act(() => { window.dispatchEvent(new CustomEvent(DEMO_LIMIT_EVENT)); });
    expect(screen.getByRole("alert")).toHaveTextContent("Tvoje práce zůstává uložená");
    expect(isDemoAiLimitBody(429, '{"error":"Demo má limit AI generování. Pro plný přístup se zaregistrujte."}')).toBe(true);
    expect(isDemoAiLimitBody(500, "Demo má limit AI generování")).toBe(false);
  });

  it("sbalený pruh publikuje jen tenký proužek, hlavička se neodsouvá", () => {
    window.localStorage.setItem(DEMO_BANNER_COLLAPSED_KEY, "1");
    view();
    const region = screen.getByRole("region", { name: "Demo" });
    expect(region.className).toContain("h-[5px]");
    expect(region.className).toContain("print:hidden");
  });
});

import { demoQuotaMessage, parseDemoQuotaError, limitChipText, isNearLimit } from "@/lib/demo-limits";
describe("kvóty dema", () => {
  it("přečte serverový kód kvóty", () => {
    expect(parseDemoQuotaError('{"message":"DEMO_QUOTA:textbooks:2"}')).toEqual({ key: "textbooks", limit: 2 });
    expect(parseDemoQuotaError("permission denied")).toBeNull();
  });
  it("hláška při dosažení kvóty", () => {
    expect(demoQuotaMessage("textbooks", 2)).toBe("Počet učebnic je v ukázce omezen na 2. V plném účtu bez omezení.");
  });
  it("čip kvóty a blízkost limitu", () => {
    const l = { key: "textbooks", label: "Učebnice", used: 1, limit: 2 };
    expect(limitChipText(l, false)).toBe("Učebnice 1/2");
    expect(isNearLimit(l)).toBe(false);
    expect(isNearLimit({ ...l, used: 2 })).toBe(true);
  });
});
