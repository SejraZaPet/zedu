import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...(a as [])) } } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import LicenseInquiryDialog from "@/components/license/LicenseInquiryDialog";

function fill() {
  fireEvent.change(screen.getByLabelText(/Jméno a příjmení/), { target: { value: "[TEST] Jana" } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "test@example.com" } });
}

describe("Poptávka – souhlas s podmínkami", () => {
  beforeEach(() => invoke.mockClear());

  it("bez zaškrtnutí nejde odeslat", async () => {
    render(<LicenseInquiryDialog open onOpenChange={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat poptávku" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bez souhlasu nelze poptávku odeslat.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("se zaškrtnutím odešle verzi podmínek 1.0 a čas souhlasu", async () => {
    render(<LicenseInquiryDialog open onOpenChange={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Odeslat poptávku" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const body = (invoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }])[1].body;
    expect(body.termsVersion).toBe("1.0");
    expect(typeof body.termsAcceptedAt).toBe("string");
  });

  it("odkazy vedou na /podminky a /gdpr do nové záložky", () => {
    render(<LicenseInquiryDialog open onOpenChange={() => {}} />);
    const terms = screen.getByRole("link", { name: "obchodními podmínkami" });
    expect(terms).toHaveAttribute("href", "/podminky");
    expect(terms).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "zásady ochrany osobních údajů" })).toHaveAttribute("href", "/gdpr");
  });
});
