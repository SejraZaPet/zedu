import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  isPresentationRoute, clampProjectorZoom, loadProjectorZoom, saveProjectorZoom, projectorStageScale,
} from "@/lib/presentation-routes";
import { useIdleChrome } from "@/hooks/useIdleChrome";

const authState = { realRole: "admin" as string, viewAsRole: "teacher" as string | null, setViewAsRole: vi.fn() };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/lib/preview-student", () => ({ isPreviewStudentSession: () => false }));
import ViewAsBanner from "@/components/ViewAsBanner";

describe("isPresentationRoute", () => {
  it("projektor, živá hra a ovládání prezentace ano", () => {
    expect(isPresentationRoute("/live/projektor/abc")).toBe(true);
    expect(isPresentationRoute("/hra/ucitel/abc")).toBe(true);
    expect(isPresentationRoute("/live/student/abc")).toBe(true);
  });
  it("Dnes a úkoly ne", () => {
    expect(isPresentationRoute("/ucitel")).toBe(false);
    expect(isPresentationRoute("/ucitel/ulohy")).toBe(false);
  });
});

describe("přiblížení projekce", () => {
  beforeEach(() => localStorage.clear());
  it("hranice 100–150 % po 10", () => {
    expect(clampProjectorZoom(90)).toBe(100);
    expect(clampProjectorZoom(160)).toBe(150);
    expect(clampProjectorZoom(123)).toBe(120);
    expect(clampProjectorZoom(NaN)).toBe(100);
  });
  it("uložení a obnova", () => {
    saveProjectorZoom(130);
    expect(loadProjectorZoom()).toBe(130);
  });
  it("chyba localStorage → výchozí 100 %", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    expect(loadProjectorZoom()).toBe(100);
    spy.mockRestore();
  });
  it("jediné zmenšení na okno: 1920×1080 = 1.2, 1440×900 = 0.9, přiblížení násobí", () => {
    expect(projectorStageScale(1920, 1080)).toBeCloseTo(1.2);
    expect(projectorStageScale(1440, 900)).toBeCloseTo(0.9);
    expect(projectorStageScale(1920, 1080, 150)).toBeCloseTo(1.8);
  });
});

describe("ViewAsBanner", () => {
  beforeEach(() => { authState.realRole = "admin"; authState.viewAsRole = "teacher"; authState.setViewAsRole.mockClear(); });
  it("na projekci jen ikona s popisem; klik vrací na admina", () => {
    render(<MemoryRouter initialEntries={["/live/projektor/x"]}><ViewAsBanner /></MemoryRouter>);
    const btn = screen.getByTestId("view-as-icon");
    expect(btn.getAttribute("aria-label")).toBe("Prohlížíš jako Učitel · Zpět na admina");
    expect(screen.queryByTestId("view-as-pill")).toBeNull();
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true });
    fireEvent.click(btn);
    expect(authState.setViewAsRole).toHaveBeenCalledWith(null);
    expect(window.location.href).toBe("/admin");
    void assign;
  });
  it("jinde jednořádková pilulka a nemění odsazení stránky", () => {
    document.body.style.paddingBottom = "";
    render(<MemoryRouter initialEntries={["/ucitel"]}><ViewAsBanner /></MemoryRouter>);
    expect(screen.getByTestId("view-as-pill").className).toContain("whitespace-nowrap");
    expect(document.body.style.paddingBottom).toBe("");
  });
  it("mimo admina se nevykreslí", () => {
    authState.realRole = "teacher";
    const { container } = render(<MemoryRouter><ViewAsBanner /></MemoryRouter>);
    expect(container.innerHTML).toBe("");
  });
});

function IdleProbe() {
  const v = useIdleChrome(true, 3000);
  return <div data-testid="probe">{v ? "on" : "off"}</div>;
}
describe("useIdleChrome", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("skryje po 3 s a ukáže při pohybu", () => {
    render(<IdleProbe />);
    expect(screen.getByTestId("probe").textContent).toBe("on");
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.getByTestId("probe").textContent).toBe("off");
    act(() => { window.dispatchEvent(new MouseEvent("mousemove")); });
    expect(screen.getByTestId("probe").textContent).toBe("on");
  });
});
