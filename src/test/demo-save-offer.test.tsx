import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DemoBanner from "@/components/demo/DemoBanner";
import { DEMO_SAVE_OFFERED_KEY } from "@/lib/demo-contact-client";

const mocks = vi.hoisted(() => ({
  hasOwn: vi.fn(),
  reload: vi.fn(),
  status: null as null | { hasContact: boolean; deletesAt: string | null; daysLeft: number | null; extended: boolean; emailMasked: string | null },
}));

vi.mock("@/lib/demo", () => ({
  useDemoPair: () => ({ side: "teacher", returnCode: "TEST-CODE" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "demo-teacher" } }),
}));
vi.mock("@/lib/demo-contact-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo-contact-client")>();
  return {
    ...actual,
    useDemoStatus: () => ({ status: mocks.status, reload: mocks.reload }),
    hasOwnDemoContent: (...args: unknown[]) => mocks.hasOwn(...args),
  };
});
vi.mock("@/components/demo/DemoSaveWorkDialog", () => ({
  default: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => open
    ? <div role="dialog"><button onClick={() => onOpenChange(false)}>Pokračovat bez e-mailu</button></div>
    : null,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;

const banner = () => <MemoryRouter><DemoBanner /></MemoryRouter>;

beforeEach(() => {
  window.localStorage.clear();
  mocks.hasOwn.mockReset();
  mocks.reload.mockReset();
  mocks.status = { hasContact: false, deletesAt: null, daysLeft: null, extended: false, emailMasked: null };
});

describe("nabídka uložení demo kontaktu", () => {
  it("při vstupu bez vlastního obsahu dialog neotevře", async () => {
    mocks.hasOwn.mockResolvedValue(false);
    render(banner());
    await waitFor(() => expect(mocks.hasOwn).toHaveBeenCalledWith("demo-teacher"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_SAVE_OFFERED_KEY)).toBeNull();
  });

  it("otevře se až po prvním obsahu, odmítnutí nevadí a samo se neopakuje", async () => {
    mocks.hasOwn.mockResolvedValue(true);
    const view = render(banner());
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_SAVE_OFFERED_KEY)).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat bez e-mailu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    view.unmount();
    render(banner());
    expect(mocks.hasOwn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Uložit moji práci" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("s uloženým kontaktem se už nevyptává", () => {
    mocks.status = { hasContact: true, deletesAt: null, daysLeft: null, extended: false, emailMasked: "j***@example.cz" };
    render(banner());
    expect(mocks.hasOwn).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
