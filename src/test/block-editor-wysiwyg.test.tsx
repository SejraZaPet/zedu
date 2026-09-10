import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlockEditor from "@/components/admin/BlockEditor";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import type { Block } from "@/lib/textbook-config";

const para = (id = "p1", props: Record<string, any> = {}): Block =>
  ({ id, type: "paragraph", visible: true, props: { text: "<p>Ahoj</p>", ...props } }) as Block;

describe("WYSIWYG editor lekce", () => {
  it("blok je v klidovém stavu bez rámečku a bez štítku typu", () => {
    const { container } = render(<BlockEditor blocks={[para()]} onChange={vi.fn()} />);
    const el = container.querySelector("[data-block-id='p1']") as HTMLElement;
    expect(el.style.borderColor).toBe("transparent");
    expect(screen.queryByText("Odstavec")).toBeNull();
  });

  it("hover zobrazí plovoucí lištu s úchytem, výběrem a menu", () => {
    const { container } = render(<BlockEditor blocks={[para()]} onChange={vi.fn()} />);
    const el = container.querySelector("[data-block-id='p1']") as HTMLElement;
    const rail = el.querySelector("div.absolute") as HTMLElement;
    expect(rail.className).toContain("opacity-0");
    fireEvent.mouseEnter(el);
    expect((el.querySelector("div.absolute") as HTMLElement).className).toContain("opacity-100");
    expect(el.querySelector("input[type='checkbox']")).not.toBeNull();
    expect(screen.getByLabelText("Možnosti bloku Odstavec")).toBeTruthy();
  });

  it("pozadí bloku se vykreslí v editoru i na žákovské straně", () => {
    const { container } = render(
      <BlockEditor blocks={[para("p2", { backgroundStyle: "note" })]} onChange={vi.fn()} />,
    );
    const styled = Array.from(container.querySelectorAll("div")).find(
      (d) => d.style.background.includes("205"),
    );
    expect(styled).toBeTruthy();

    const { container: c2 } = render(<LessonBlock block={para("p3", { backgroundStyle: "tip" })} />);
    expect((c2.firstElementChild as HTMLElement).style.background).toContain("266");
  });
});
