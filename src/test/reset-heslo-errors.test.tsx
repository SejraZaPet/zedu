import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ResetHeslo from "@/pages/ResetHeslo";
import { WEAK_PASSWORD_MESSAGE } from "@/lib/password-policy";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

const TOKEN = "a".repeat(64);
const STRONG_PASSWORD = "Tri-Slova-Za-Sebou";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/reset-heslo?token=${TOKEN}`]}>
      <ResetHeslo />
    </MemoryRouter>,
  );
}

function fillStrongPassword() {
  fireEvent.change(screen.getByLabelText("Nové heslo"), { target: { value: STRONG_PASSWORD } });
  fireEvent.change(screen.getByLabelText("Potvrdit heslo"), { target: { value: STRONG_PASSWORD } });
}

describe("ResetHeslo", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.navigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("weak_password nechá formulář, vyplněné heslo i stejný token", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: async () => ({ code: "weak_password", error: WEAK_PASSWORD_MESSAGE }) },
      },
    });
    renderPage();
    fillStrongPassword();
    fireEvent.click(screen.getByRole("button", { name: "Uložit nové heslo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(WEAK_PASSWORD_MESSAGE);
    expect(screen.getByRole("heading", { name: "Nastavit nové heslo" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Neplatný odkaz" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nové heslo")).toHaveValue(STRONG_PASSWORD);
    expect(screen.getByRole("button", { name: "Uložit nové heslo" })).toBeEnabled();
    expect(mocks.invoke).toHaveBeenCalledWith("confirm-password-reset", {
      body: { token: TOKEN, new_password: STRONG_PASSWORD },
    });
  });

  it("invalid_token ukáže obrazovku Neplatný odkaz", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: { json: async () => ({ code: "invalid_token", error: "Odkaz je neplatný nebo vypršel." }) },
      },
    });
    renderPage();
    fillStrongPassword();
    fireEvent.click(screen.getByRole("button", { name: "Uložit nové heslo" }));

    expect(await screen.findByRole("heading", { name: "Neplatný odkaz" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uložit nové heslo" })).not.toBeInTheDocument();
  });

  it("úspěch přesměruje na /auth", async () => {
    vi.useFakeTimers();
    mocks.invoke.mockResolvedValue({ data: { message: "Heslo bylo změněno." }, error: null });
    renderPage();
    fillStrongPassword();
    fireEvent.click(screen.getByRole("button", { name: "Uložit nové heslo" }));

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("heading", { name: "Heslo změněno!" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(mocks.navigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("běžné heslo odmítne lokálně bez volání funkce", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nové heslo"), { target: { value: "heslo123" } });
    fireEvent.change(screen.getByLabelText("Potvrdit heslo"), { target: { value: "heslo123" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit nové heslo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(WEAK_PASSWORD_MESSAGE);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nové heslo")).toHaveValue("heslo123");
  });
});
