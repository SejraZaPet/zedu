import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), insert: vi.fn(), error: vi.fn(),
  portfolioUpload: vi.fn(), materialUpload: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: path } }) }) },
  from: () => ({ insert: mocks.insert }),
} }));
vi.mock("@/lib/portfolio", () => ({ uploadPortfolioAttachment: mocks.portfolioUpload }));
vi.mock("@/lib/assignment-materials", () => ({
  uploadMaterialFile: mocks.materialUpload, validateMaterialFile: () => null,
  formatBytes: () => "", mediaKindOf: () => "image", normalizeUrl: (v: string) => v,
  removeMaterialFile: vi.fn(),
}));
import GalleryBlock from "@/components/admin/block-editors/GalleryBlock";
import AddPortfolioItemDialog from "@/components/portfolio/AddPortfolioItemDialog";
import AssignmentMaterialsEditor from "@/components/assignments/AssignmentMaterialsEditor";

const photos = () => [new File(["a"], "[TEST]a.jpg", { type: "image/jpeg" }), new File(["b"], "[TEST]b.png", { type: "image/png" })];
beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue({ error: null }); });

describe("výběr více fotografií", () => {
  it("galerie vloží obě fotky jedním zápisem a zachová původní obrázek", async () => {
    const onChange = vi.fn();
    render(<GalleryBlock block={{ id: "g", type: "gallery", props: { images: [{ url: "old", caption: "old" }] } } as any} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Nahrát více obrázků do galerie"), { target: { files: photos() } });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0].images).toHaveLength(3);
    expect(onChange.mock.calls[0][0].images[0].url).toBe("old");
  });
  it("selhání první fotky nezahodí druhou a zobrazí chybu", async () => {
    mocks.upload.mockResolvedValueOnce({ error: { message: "[TEST] denied" } });
    const onChange = vi.fn();
    render(<GalleryBlock block={{ id: "g", type: "gallery", props: {} } as any} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Nahrát více obrázků do galerie"), { target: { files: photos() } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].images).toHaveLength(1);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("[TEST] denied"));
  });
  it("portfolio nahraje obě přílohy a uloží obě vazby", async () => {
    mocks.portfolioUpload.mockImplementation(async (_id, file) => file.name);
    const single = vi.fn().mockResolvedValue({ data: { id: "[TEST]item" }, error: null });
    mocks.insert.mockReturnValueOnce({ select: () => ({ single }) }).mockResolvedValueOnce({ error: null });
    render(<AddPortfolioItemDialog studentId="[TEST]student" />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat položku" }));
    fireEvent.change(screen.getByLabelText("Název *"), { target: { value: "[TEST]item" } });
    fireEvent.change(screen.getByLabelText("Přílohy"), { target: { files: photos() } });
    fireEvent.click(screen.getByRole("button", { name: /^Přidat$/ }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(2));
    expect(mocks.portfolioUpload).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toHaveLength(2);
  });
  it("materiály neztratí druhý soubor po vyprázdnění mobilního FileList", async () => {
    mocks.materialUpload.mockImplementation(async (file) => ({ id: file.name, kind: "file", title: file.name }));
    const onChange = vi.fn();
    const { container } = render(<AssignmentMaterialsEditor materials={[]} teacherId="[TEST]teacher" onChange={onChange} />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing input");
    fireEvent.change(input, { target: { files: photos() } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(mocks.materialUpload).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });
});