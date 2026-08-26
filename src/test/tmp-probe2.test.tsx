import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import Dlg from "@/components/admin/ImportPptxToPresentationDialog";
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: (a: any) => console.log("TOAST", a) }) }));
it("p", async () => {
  const b = readFileSync("/tmp/pptx-fixture/test-3-slides.pptx");
  const f = new File([new Uint8Array(b)], "a.pptx");
  const onImported = vi.fn();
  render(<Dlg open onOpenChange={() => {}} onImported={onImported} />);
  const input = document.getElementById("pptx-import-file") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [f] } });
  console.log("size", f.size, "disabled", (screen.getByRole("button", { name: /Importovat snímky/i }) as HTMLButtonElement).disabled);
  fireEvent.click(screen.getByRole("button", { name: /Importovat snímky/i }));
  await waitFor(() => expect(onImported).toHaveBeenCalled(), { timeout: 3000 }).catch(() => console.log("no call"));
});
