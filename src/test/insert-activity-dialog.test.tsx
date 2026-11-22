import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import InsertActivityDialog from "@/components/presentation/InsertActivityDialog";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: vi.fn() }, functions: { invoke: vi.fn() } } }));

describe("dialog Vložit aktivitu", () => {
  it("nabídne čtyři cesty, seskupené typy a vloží upravený živý náhled", () => {
    const onInsert = vi.fn();
    render(<InsertActivityDialog open onOpenChange={vi.fn()} onInsert={onInsert} themeId="minimal" />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    for (const label of ["Otázky", "Procvičování", "Obrázky", "Zapojení třídy", "Skupiny a zážitek"]) expect(screen.getByText(label)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kvíz Otázka s výběrem odpovědi" }));
    expect(screen.getByLabelText("Živý náhled aktivity")).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText("Otázka")[0], { target: { value: "Upravená otázka" } });
    fireEvent.click(screen.getByRole("radio", { name: "Na aktuální slide" }));
    fireEvent.click(screen.getByRole("button", { name: /^Vložit aktivitu$/ }));
    expect(onInsert).toHaveBeenCalledOnce();
    expect(onInsert.mock.calls[0][0].activitySpec.question).toBe("Upravená otázka");
    expect(onInsert.mock.calls[0][1]).toBe("slide");
  });

  it("cesta z materiálu používá sdílený SourceInput a AI se spustí až explicitně", () => {
    render(<InsertActivityDialog open onOpenChange={vi.fn()} onInsert={vi.fn()} themeId="minimal" />);
    fireEvent.click(screen.getByRole("tab", { name: "Navrhnout z mého materiálu" }));
    expect(screen.getByRole("button", { name: "Vložit text" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Navrhnout aktivitu" })).toBeDisabled();
    expect(screen.getByText(/Materiál se neukládá/)).toBeTruthy();
  });
});
