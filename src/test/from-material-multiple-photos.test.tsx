import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks = vi.hoisted(() => ({ toast: vi.fn(), invoke: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "[TEST]student" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/components/WorksheetPlayer", () => ({ default: () => null }));
vi.mock("@/lib/pdf-page-renderer", () => ({ extractPdfText: vi.fn() }));
import FromMaterialView from "@/components/from-material/FromMaterialView";
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});
const photos = (count: number) => Array.from({ length: count }, (_, i) => new File(["image"], `[TEST]${i}.jpg`, { type: "image/jpeg" }));
describe("Z materiálu – galerie a kamera", () => {
  it("načte obě fotografie bez spuštění AI a uvolní náhledy při odchodu", async () => {
    const view = render(<MemoryRouter><FromMaterialView role="student" /></MemoryRouter>);
    const input = view.container.querySelector('input[multiple]');
    if (!input) throw new Error("Missing gallery input");
    fireEvent.change(input, { target: { files: photos(2) } });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Odebrat" })).toHaveLength(2));
    expect(mocks.invoke).not.toHaveBeenCalled();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
  it("sedm fotek odmítne s chybou místo tichého zahození sedmé", async () => {
    const view = render(<MemoryRouter><FromMaterialView role="teacher" /></MemoryRouter>);
    const input = view.container.querySelector('input[multiple]');
    if (!input) throw new Error("Missing gallery input");
    fireEvent.change(input, { target: { files: photos(7) } });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nejvýše 6 fotek", variant: "destructive" }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});