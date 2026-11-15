import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), notebookUpload: vi.fn(), insert: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: path } }) }) },
  from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) }),
} }));
vi.mock("@/lib/notebook", async (original) => ({
  ...await original<typeof import("@/lib/notebook")>(), uploadNotebookImage: mocks.notebookUpload,
}));
vi.mock("@/components/notebook/NotebookImageContent", () => ({ default: () => null }));
import NotebookCanvas from "@/components/notebook/NotebookCanvas";
import AttachmentsUploader from "@/components/assignments/AttachmentsUploader";
import BulkUploadDialog from "@/components/admin/BulkUploadDialog";

const photos = () => [new File(["a"], "[TEST]a.jpg", { type: "image/jpeg" }), new File(["b"], "[TEST]b.png", { type: "image/png" })];
beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  mocks.upload.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
});
describe("dokončení celé dávky", () => {
  it("sešit přidá obě fotky jedním zápisem a zachová zamčené pozadí", async () => {
    mocks.notebookUpload.mockImplementation(async (_id, file) => file.name);
    const onChange = vi.fn();
    const content = { strokes: [], textBoxes: [], images: [{ id: "background", path: "old", x: 0, y: 0, w: 1, h: 1, locked: true }] };
    const { container } = render(<NotebookCanvas ownerId="[TEST]owner" content={content} backgroundStyle="blank" onChange={onChange} />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing input");
    fireEvent.change(input, { target: { files: photos() } });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(mocks.notebookUpload).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0].images).toHaveLength(3);
    expect(onChange.mock.calls[0][0].images[0]).toEqual(content.images[0]);
  });
  it("úkol zůstává zablokovaný do dokončení druhé přílohy", async () => {
    let finish: ((value: { error: null }) => void) | undefined;
    mocks.upload.mockResolvedValueOnce({ error: null }).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { container } = render(<AttachmentsUploader assignmentId="[TEST]assignment" studentId="[TEST]student" />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing input");
    fireEvent.change(input, { target: { files: photos() } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Vybrat soubory" })).toBeDisabled();
    if (!finish) throw new Error("Missing pending request");
    finish({ error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "Vybrat soubory" })).toBeEnabled());
    expect(mocks.insert).toHaveBeenCalledTimes(2);
  });
  it("avatar přijme celou dávku JPEG/PNG i s prázdným MIME od mobilu", async () => {
    render(<BulkUploadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    const input = screen.getByRole("dialog").querySelector('input[type="file"]');
    if (!input) throw new Error("Missing input");
    fireEvent.change(input, { target: { files: [new File(["a"], "[TEST]a.jpg"), new File(["b"], "[TEST]b.png")] } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Uložit vše (2)" })).toBeEnabled());
  });
});