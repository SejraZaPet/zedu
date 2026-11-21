import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadNotebooks: vi.fn(),
  createNotebook: vi.fn(),
  appendTextPage: vi.fn(),
  savePortfolio: vi.fn(),
  savePracticeSource: vi.fn(() => true),
  navigate: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "student-1" } }) }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/notebook", () => ({
  loadNotebooks: mocks.loadNotebooks,
  createNotebook: mocks.createNotebook,
  appendTextPageToNotebook: mocks.appendTextPage,
}));
vi.mock("@/lib/portfolio", () => ({ saveTextToPortfolio: mocks.savePortfolio }));
vi.mock("@/lib/practice-method", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/practice-method")>()),
  savePracticeSource: mocks.savePracticeSource,
}));

import BezlaiSummaryDialog from "@/components/student/BezlaiSummaryDialog";
import type { BezlaiSummaryDraft } from "@/lib/bezlai-summary";

const draft: BezlaiSummaryDraft = { title: "Hovězí maso", text: "Hlavní body:\n- Dělení masa\n\nZdroje:\n- Můj materiál", aiModifiedAt: null };

function renderDialog(onDraftChange = vi.fn()) {
  return render(<MemoryRouter><BezlaiSummaryDialog open onOpenChange={vi.fn()} loading={false} error={null} onRetry={vi.fn()} draft={draft} onDraftChange={onDraftChange} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  mocks.loadNotebooks.mockResolvedValue([]);
  mocks.createNotebook.mockResolvedValue({ id: "nb-new", title: "Hovězí maso", owner_id: "student-1" });
  mocks.appendTextPage.mockResolvedValue({ id: "page-1", notebook_id: "nb-new", page_order: 1 });
  mocks.savePortfolio.mockResolvedValue({ id: "pf-1" });
  mocks.savePracticeSource.mockReturnValue(true);
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => {} });
});
afterEach(cleanup);

describe("Bezlai – ručně potvrzené uložení poznámek", () => {
  it("bez sešitu nabídne nový, vloží poslední stránku až po kliknutí a ukáže odkaz", async () => {
    renderDialog();
    expect(mocks.createNotebook).not.toHaveBeenCalled();
    expect(mocks.appendTextPage).not.toHaveBeenCalled();
    expect(mocks.savePortfolio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Vložit do sešitu" }));
    expect(await screen.findByLabelText("Název nového sešitu")).toHaveValue("Hovězí maso");
    fireEvent.click(screen.getByRole("button", { name: "Vložit jako novou stránku na konec" }));
    await waitFor(() => expect(mocks.appendTextPage).toHaveBeenCalledWith({ notebookId: "nb-new", title: draft.title, text: draft.text, aiModifiedAt: null }));
    expect(mocks.createNotebook).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Otevřít sešit" })).toHaveAttribute("href", "/student/sesit?otevrit=nb-new&strana=page-1");
  });

  it("při selhání vložení zachová text a retry nezaloží druhý sešit", async () => {
    mocks.appendTextPage.mockRejectedValueOnce(new Error("Zápis se nepodařil"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Vložit do sešitu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vložit jako novou stránku na konec" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Zápis se nepodařil");
    expect(screen.getByLabelText("Hlavní body a zdroje")).toHaveValue(draft.text);
    fireEvent.click(screen.getByRole("button", { name: "Zkusit vložení znovu" }));
    await waitFor(() => expect(mocks.appendTextPage).toHaveBeenCalledTimes(2));
    expect(mocks.createNotebook).toHaveBeenCalledTimes(1);
  });

  it("i u existujících sešitů obsahuje výběr + Nový sešit", async () => {
    mocks.loadNotebooks.mockResolvedValue([{ id: "nb-1", title: "Kuchařka", subject: "Přínos" }]);
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Vložit do sešitu" }));
    const picker = await screen.findByRole("combobox", { name: "Sešit pro poznámky" });
    await waitFor(() => expect(picker).toHaveTextContent("Kuchařka"));
    fireEvent.click(picker);
    expect(await screen.findByRole("option", { name: "+ Nový sešit" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Kuchařka/ })).toBeInTheDocument();
  });

  it("chyba portfolia nemaže koncept a umožní stejné uložení zopakovat", async () => {
    mocks.savePortfolio.mockRejectedValueOnce(new Error("Portfolio je nedostupné"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Uložit do portfolia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Portfolio je nedostupné");
    expect(screen.getByLabelText("Hlavní body a zdroje")).toHaveValue(draft.text);
    fireEvent.click(screen.getByRole("button", { name: "Zkusit uložit znovu" }));
    await waitFor(() => expect(mocks.savePortfolio).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("link", { name: "Otevřít portfolio" })).toHaveAttribute("href", "/student/portfolio");
  });

  it("kartičky i kvíz použijí savePracticeSource a správnou existující cestu", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Udělat kartičky" }));
    expect(mocks.savePracticeSource).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "text", label: "Bezlai – Hovězí maso" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith("/student/z-materialu?typ=flashcards");
    fireEvent.click(screen.getByRole("button", { name: "Udělat kvíz" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith("/student/z-materialu?typ=mcq");
    expect(mocks.createNotebook).not.toHaveBeenCalled();
    expect(mocks.savePortfolio).not.toHaveBeenCalled();
  });
});
