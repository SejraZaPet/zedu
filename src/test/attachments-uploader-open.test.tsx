import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  files: [] as any[],
  getUrl: vi.fn(),
  open: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const query: any = {};
      for (const method of ["select", "eq", "order"]) {
        query[method] = vi.fn(() => query);
      }
      query.then = (resolve: any) => Promise.resolve({ data: mocks.files, error: null }).then(resolve);
      return query;
    }),
  },
}));

vi.mock("@/lib/portfolio", () => ({
  ASSIGNMENT_UPLOADS_BUCKET: "assignment-uploads",
  getStudentAttachmentSignedUrl: mocks.getUrl,
  removeStudentAttachmentFile: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: mocks.toast,
  useToast: () => ({ toast: mocks.toast }),
}));

import AttachmentsUploader from "@/components/assignments/AttachmentsUploader";

const attachment = {
  id: "file-1",
  file_name: "reseni.pdf",
  file_path: "assignment-1/student-1/reseni.pdf",
  file_size: 2048,
  uploaded_at: "2026-11-25T08:00:00Z",
};

describe("otevření žákovské přílohy", () => {
  beforeEach(() => {
    mocks.files = [attachment];
    mocks.getUrl.mockResolvedValue("https://files.example/signed/reseni.pdf");
    window.open = mocks.open as typeof window.open;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("vytvoří odkaz až po klepnutí a otevře jej v nové záložce", async () => {
    render(<AttachmentsUploader assignmentId="assignment-1" studentId="student-1" />);

    const openButton = await screen.findByRole("button", { name: "Otevřít reseni.pdf" });
    expect(mocks.getUrl).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Smazat reseni.pdf" })).toBeInTheDocument();

    fireEvent.click(openButton);

    await waitFor(() => expect(mocks.getUrl).toHaveBeenCalledWith(
      "assignment-1/student-1/reseni.pdf",
      { expiresIn: 300 },
    ));
    expect(mocks.open).toHaveBeenCalledWith(
      "https://files.example/signed/reseni.pdf",
      "_blank",
      "noopener",
    );
  });

  it("po odevzdání nechá otevření dostupné, ale skryje smazání", async () => {
    render(<AttachmentsUploader assignmentId="assignment-1" studentId="student-1" disabled />);

    const openButton = await screen.findByRole("button", { name: "Otevřít reseni.pdf" });
    expect(openButton).toBeEnabled();
    expect(openButton).toHaveClass("min-h-11");
    expect(screen.queryByRole("button", { name: "Smazat reseni.pdf" })).not.toBeInTheDocument();

    fireEvent.click(openButton);
    await waitFor(() => expect(mocks.getUrl).toHaveBeenCalledWith(attachment.file_path, { expiresIn: 300 }));
  });

  it("při neúspěchu ukáže chybové upozornění", async () => {
    mocks.getUrl.mockResolvedValue(null);
    render(<AttachmentsUploader assignmentId="assignment-1" studentId="student-1" disabled />);

    fireEvent.click(await screen.findByRole("button", { name: "Otevřít reseni.pdf" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Soubor se nepodařilo otevřít",
      variant: "destructive",
    })));
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
