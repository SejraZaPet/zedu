import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BlockStyleControls from "@/components/admin/block-editors/BlockStyleControls";
import ColorPalettePopover from "@/components/ui/color-palette-popover";
import GradientPicker from "@/components/admin/GradientPicker";
import type { Block } from "@/lib/textbook-config";

const rows = [
  { id: "p-1", name: "Firemní modrá", colors: ["#2563eb"], created_at: new Date().toISOString() },
];
const inserted: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ order: async () => ({ data: rows, error: null }) }),
      insert: async (v: any) => {
        inserted.push(v);
        return { error: null };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

const block = (props: Record<string, any> = {}): Block =>
  ({ id: "p1", type: "paragraph", visible: true, props: { text: "<p>Ahoj</p>", ...props } }) as Block;

describe("vlastní uložené palety", () => {
  it("uložená paleta je vidět a použitelná u barvy textu", async () => {
    const onChange = vi.fn();
    render(
      <ColorPalettePopover value="#dc2626" onChange={onChange} trigger={<button>Barva</button>} />,
    );
    fireEvent.click(screen.getByText("Barva"));
    expect(await screen.findByText("Moje palety")).toBeTruthy();
    fireEvent.click(await screen.findByTitle("Firemní modrá"));
    expect(onChange).toHaveBeenCalledWith("#2563eb");
  });

  it("stejná paleta je použitelná u pozadí bloku", async () => {
    const onChange = vi.fn();
    render(<BlockStyleControls block={block()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Vlastní barva pozadí"));
    expect(await screen.findByText("Moje palety")).toBeTruthy();
    fireEvent.click(await screen.findByTitle("Firemní modrá"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundColor: "#2563eb" }),
    );
  });

  it("aktuální barvu lze uložit jako novou paletu", async () => {
    render(<GradientPicker value={{ from: "#6EC6D9", to: "#9B6CFF" }} onChange={vi.fn()} />);
    fireEvent.click(await screen.findByText("Uložit jako paletu"));
    fireEvent.change(screen.getByLabelText("Název palety"), { target: { value: "Moje duha" } });
    fireEvent.click(screen.getByText("Uložit"));
    await waitFor(() => expect(inserted.length).toBe(1));
    expect(inserted[0].name).toBe("Moje duha");
    expect(inserted[0].colors[0]).toMatchObject({ from: "#6EC6D9", to: "#9B6CFF" });
  });
});
