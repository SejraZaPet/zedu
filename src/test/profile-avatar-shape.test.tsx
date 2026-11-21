import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";

describe("ProfileAvatarBubble – volitelný tvar", () => {
  afterEach(() => cleanup());

  it("výchozí vykreslení zachová původní zaoblení", () => {
    const { container } = render(<ProfileAvatarBubble userId={null} editable={false} />);
    const avatar = container.querySelector("[data-avatar-shape]");
    expect(avatar).toHaveAttribute("data-avatar-shape", "circle");
    expect(avatar).toHaveClass("rounded-[14px]");
    expect(avatar).not.toHaveClass("rounded-[8px]");
  });

  it("čtverec použije radius 8 px jen při výslovné volbě", () => {
    const { container } = render(<ProfileAvatarBubble userId={null} editable={false} shape="square" size={96} />);
    const avatar = container.querySelector("[data-avatar-shape]");
    expect(avatar).toHaveAttribute("data-avatar-shape", "square");
    expect(avatar).toHaveClass("rounded-[8px]");
    expect(avatar).toHaveStyle({ width: "96px", height: "96px" });
  });
});
