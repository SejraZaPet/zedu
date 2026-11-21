import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  saveSource: vi.fn(() => true),
  navigate: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    functions: { invoke: mocks.invoke },
    from: (table: string) => {
      if (table === "study_methods") {
        return {
          select: () => ({
            order: async () => ({
              data: [{ id: "m1", name: "Pět kroků", slug: "pet-kroku", description: null, icon: "Brain", steps_json: [] }],
              error: null,
            }),
          }),
        };
      }
      return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    },
  },
}));
vi.mock("@/lib/demo", () => ({ useDemoPair: () => null }));
vi.mock("@/components/SiteHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div /> }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/student-practice-lessons", () => ({ fetchStudentPracticeLessons: async () => [] }));
vi.mock("@/hooks/useStudentPracticeLessons", () => ({
  useStudentPracticeLessons: () => ({ data: [], isPending: false, isError: false, isFetching: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/practice-method", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/practice-method")>()),
  savePracticeSource: mocks.saveSource,
}));
vi.mock("@/lib/practice-photo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/practice-photo")>()),
  preparePracticePhoto: mocks.prepare,
  disposePracticePhoto: vi.fn(),
}));

import StudentMethods from "@/pages/StudentMethods";
import { PRACTICE_PHOTO_UNREADABLE_MESSAGE } from "@/lib/practice-photo";

(Element.prototype as any).scrollIntoView = () => {};
(HTMLElement.prototype as any).hasPointerCapture = () => false;
(HTMLElement.prototype as any).releasePointerCapture = () => {};

const LONG_TEXT = "Fotosyntéza probíhá v chloroplastech a používá světlo. ".repeat(5).trim();
const prepared = {
  imageBase64: "anBlZw==",
  mimeType: "image/jpeg" as const,
  previewUrl: "blob:test-photo",
  width: 1200,
  height: 1600,
  sizeBytes: 1000,
};

async function openPhotoDialog() {
  render(<MemoryRouter><StudentMethods /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Pět kroků/ }));
  fireEvent.click(screen.getByRole("button", { name: "Procvičit" }));
  const source = screen.getByRole("combobox", { name: "Zdroj" });
  fireEvent.click(source);
  fireEvent.keyDown(source, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Fotografie" }));
  const input = document.getElementById("practice-photo") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["photo"], "stranka.jpg", { type: "image/jpeg" })] } });
  await screen.findByRole("img", { name: "Náhled fotografie stránky s učivem" });
}

describe("Učím se – kontrola textu z fotky", () => {
  beforeEach(() => {
    mocks.prepare.mockResolvedValue(prepared);
    mocks.invoke.mockResolvedValue({ data: { text: LONG_TEXT }, error: null });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("před potvrzením neuloží zdroj ani nepustí procvičování", async () => {
    await openPhotoDialog();
    const start = screen.getByRole("button", { name: "Spustit procvičování" });
    expect(start).toBeDisabled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.saveSource).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Přečíst text z fotky" }));
    const textarea = await screen.findByLabelText("Přepsáno AI – zkontroluj text");
    expect(textarea).toHaveValue(LONG_TEXT);
    expect(start).toBeDisabled();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith("extract-practice-photo-text", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalledWith("ai-practice-rag", expect.anything());

    fireEvent.change(textarea, { target: { value: "málo" } });
    expect(screen.getByRole("button", { name: "Potvrdit text" })).toBeDisabled();
    fireEvent.change(textarea, { target: { value: LONG_TEXT } });
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit text" }));
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    expect(mocks.saveSource).toHaveBeenCalledWith({ kind: "photo", text: LONG_TEXT, label: "Fotografie" });
    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("source=custom"));
    expect(mocks.invoke).not.toHaveBeenCalledWith("ai-practice-rag", expect.anything());
  });

  it("připojí druhou fotku, sloučí texty a po přeřazení vyžaduje nové potvrzení", async () => {
    await openPhotoDialog();
    const input = document.getElementById("practice-photo") as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.hasAttribute("capture")).toBe(false);
    const second = "[TEST] Druhá stránka učiva. ".repeat(8).trim();
    fireEvent.change(input, { target: { files: [new File(["photo"], "druha.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    mocks.invoke.mockResolvedValueOnce({ data: { text: LONG_TEXT }, error: null }).mockResolvedValueOnce({ data: { text: second }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Přečíst text z fotek" }));
    const textarea = await screen.findByLabelText("Přepsáno AI – zkontroluj text");
    expect(textarea).toHaveValue(`${LONG_TEXT}\n\n${second}`);
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit text" }));
    expect(screen.getByRole("button", { name: "Spustit procvičování" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Fotka 2: nahoru" }));
    expect(textarea).toHaveValue(`${second}\n\n${LONG_TEXT}`);
    expect(screen.getByRole("button", { name: "Spustit procvičování" })).toBeDisabled();
  });

  it("nad 8000 znaků zachová text a zablokuje potvrzení i spuštění", async () => {
    mocks.invoke.mockResolvedValue({ data: { text: "X".repeat(8001) }, error: null });
    await openPhotoDialog();
    fireEvent.click(screen.getByRole("button", { name: "Přečíst text z fotky" }));
    expect(await screen.findByLabelText("Přepsáno AI – zkontroluj text")).toHaveValue("X".repeat(8001));
    expect(screen.getByRole("button", { name: "Potvrdit text" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Spustit procvičování" })).toBeDisabled();
    expect(mocks.saveSource).not.toHaveBeenCalled();
  });

  it("nečitelná fotka ukáže přesnou hlášku a zůstane bez spuštění", async () => {
    mocks.invoke.mockResolvedValue({ data: { error: "UNREADABLE_PHOTO" }, error: null });
    await openPhotoDialog();
    fireEvent.click(screen.getByRole("button", { name: "Přečíst text z fotky" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(PRACTICE_PHOTO_UNREADABLE_MESSAGE);
    expect(screen.getByRole("button", { name: "Zkusit znovu" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Upravit / doplnit ručně" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Spustit procvičování" })).toBeDisabled();
    expect(mocks.saveSource).not.toHaveBeenCalled();
  });
});
