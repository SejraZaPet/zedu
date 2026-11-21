import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), demoPair: null as null | { id: string } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: "student-1" } } } })) },
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));
vi.mock("@/lib/demo", () => ({ useDemoPair: () => mocks.demoPair }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "student-1" } }) }));
vi.mock("@/lib/notebook", () => ({ loadNotebooks: vi.fn(async () => []), createNotebook: vi.fn(), appendTextPageToNotebook: vi.fn() }));
vi.mock("@/lib/portfolio", () => ({ saveTextToPortfolio: vi.fn() }));
vi.mock("@/hooks/useStudentPracticeLessons", () => ({
  useStudentPracticeLessons: () => ({ data: [], isPending: false, isFetching: false, isError: false, refetch: vi.fn() }),
}));

import BezlaiTutorChat from "@/components/BezlaiTutorChat";
import { BEZLAI_GENERAL_SOURCE_LABEL, readBezlaiMessengerDraft } from "@/lib/bezlai-verification";

const LONG_TEXT = "Hovězí maso dělíme podle částí zvířete a způsobu tepelné úpravy. ".repeat(4).trim();

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ data: [{ id: "teacher-1", name: "Učitel Test", is_teacher: true, class_id: "class-1", class_name: "1. A" }], error: null });
  mocks.demoPair = null;
  sessionStorage.clear();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => {} });
});
afterEach(cleanup);

describe("Bezlai – materiál a režimy", () => {
  it("ve volném režimu předá potvrzený vlastní text a vytvoří upravitelné shrnutí", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { reply: "Vycházím z tvého materiálu „Moje poznámky“." }, error: null })
      .mockResolvedValueOnce({ data: { reply: "NÁZEV: Hovězí maso\nHLAVNÍ BODY:\n- Dělení masa\nZDROJE:\n- Můj materiál" }, error: null });
    render(<MemoryRouter><BezlaiTutorChat mode="free" question="" open hideTrigger /></MemoryRouter>);

    expect(screen.getByText(/jsem Bezlai, umělá inteligence/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Přidat materiál" }));
    fireEvent.change(screen.getByLabelText("Tvůj text"), { target: { value: LONG_TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "Použít v konverzaci" }));
    expect(screen.getByText(/Vlastní text ·/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Otázka pro Bezlai"), { target: { value: "Jak se maso dělí?" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    await screen.findByText("Vycházím z tvého materiálu „Moje poznámky“.");
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "ask-zedai-tutor", expect.objectContaining({
      body: expect.objectContaining({ mode: "free", task: "chat", material: { kind: "text", text: LONG_TEXT, label: "Vlastní text" } }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Shrnout do poznámek" }));
    expect(await screen.findByLabelText("Název tématu")).toHaveValue("Hovězí maso");
    expect(screen.getByLabelText("Hlavní body a zdroje")).toHaveValue("Hlavní body:\n- Dělení masa\n\nZdroje:\n- Můj materiál");
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "ask-zedai-tutor", expect.objectContaining({
      body: expect.objectContaining({ mode: "free", task: "summary", material: expect.objectContaining({ text: LONG_TEXT }) }),
    }));
  });

  it("kontextový režim nenabídne materiál ani shrnutí a zachová původní požadavek", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { reply: "Začni tím, co víš ze zadání." }, error: null });
    render(<MemoryRouter><BezlaiTutorChat mode="context" question="Vypočítej příklad" open hideTrigger /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Přidat materiál" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Čemu nerozumíš"), { target: { value: "Nevím, kde začít" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    await screen.findByText("Začni tím, co víš ze zadání.");
    expect(screen.queryByRole("button", { name: "Shrnout do poznámek" })).not.toBeInTheDocument();
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body).toMatchObject({ mode: "context", task: "chat", question: "Vypočítej příklad" });
    expect(body).not.toHaveProperty("material");
  });

  it("chyba shrnutí zachová konverzaci a nabídne opakování", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { reply: "První odpověď" }, error: null })
      .mockResolvedValueOnce({ data: { error: "Dočasně nedostupné" }, error: null })
      .mockResolvedValueOnce({ data: { reply: "NÁZEV: Téma\nHLAVNÍ BODY:\n- Bod\nZDROJE:\n- Konverzace s Bezlai" }, error: null });
    render(<MemoryRouter><BezlaiTutorChat mode="free" question="" open hideTrigger /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Otázka pro Bezlai"), { target: { value: "Otázka" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    fireEvent.click(await screen.findByRole("button", { name: "Shrnout do poznámek" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dočasně nedostupné");
    expect(screen.getByText("První odpověď")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    await waitFor(() => expect(screen.getByLabelText("Název tématu")).toHaveValue("Téma"));
  });

  it("zelený štítek použije serverová sources a odkáže na skutečnou lekci", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: {
      reply: "Podle lekce dělíme maso na přední a zadní.",
      grounded: true,
      sources: [{ title: "Hovězí maso", kind: "Lekce z učebnice", href: "/ucebnice/gastronomie/1/topic-1/lesson-1" }],
    }, error: null });
    render(<MemoryRouter><BezlaiTutorChat mode="free" question="" open hideTrigger /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Otázka pro Bezlai"), { target: { value: "Jak se maso dělí?" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    const link = await screen.findByRole("link", { name: "Hovězí maso – otevřít zdroj" });
    expect(link).toHaveAttribute("href", "/ucebnice/gastronomie/1/topic-1/lesson-1");
    expect(screen.getByText("Z tvých materiálů:")).toBeInTheDocument();
    expect(screen.queryByText(BEZLAI_GENERAL_SOURCE_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ověřit s učitelem" })).not.toBeInTheDocument();
  });

  it("žlutá odpověď má pevný návod a učitel dostane jen kontrolovaný koncept bez odeslání", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { reply: "Obecná odpověď bez ověřeného zdroje.", grounded: false, sources: [] }, error: null });
    render(<MemoryRouter><BezlaiTutorChat mode="free" question="" open hideTrigger /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Otázka pro Bezlai"), { target: { value: "Jak můžu vědět, že je to správné?" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat" }));
    expect(await screen.findByText(BEZLAI_GENERAL_SOURCE_LABEL)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Jak si to ověřit" }).at(-1)!);
    expect(screen.getByText("Porovnej aspoň dva nezávislé zdroje, které od sebe informaci neopsaly.")).toBeInTheDocument();
    expect(screen.getByText("Nevím to jistě. Jsem AI a můžu se mýlit. Ověř si to v lekci nebo se zeptej učitele.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);

    fireEvent.click(screen.getByRole("button", { name: "Ověřit s učitelem" }));
    const textarea = await screen.findByLabelText("Text pro učitele");
    expect((textarea as HTMLTextAreaElement).value).toContain("Moje otázka:\nJak můžu vědět, že je to správné?");
    expect((textarea as HTMLTextAreaElement).value).toContain("Odpověď Bezlai:\nObecná odpověď bez ověřeného zdroje.");
    const continueButton = screen.getByRole("button", { name: "Pokračovat do zpráv" });
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    expect(readBezlaiMessengerDraft()).toEqual({ teacherId: "teacher-1", text: expect.stringContaining("Odpověď Bezlai:") });
    expect(mocks.rpc).toHaveBeenCalledWith("messenger_contacts");
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("v demu u fotografií ukáže limit pěti AI přepisů", () => {
    mocks.demoPair = { id: "demo-pair" };
    render(<MemoryRouter><BezlaiTutorChat mode="free" question="" open hideTrigger /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Přidat materiál" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Zdroj" }));
    fireEvent.click(screen.getByRole("option", { name: /Fotografie/ }));
    expect(screen.getByRole("note")).toHaveTextContent("Demo účet má limit 5 AI volání");
  });
});
