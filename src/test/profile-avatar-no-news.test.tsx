import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      mocks.from(table);
      if (table !== "avatar_profiles") throw new Error(`Novinky znovu načítají tabulku: ${table}`);
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  },
}));

import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";

describe("Profilový avatar bez novinek", () => {
  afterEach(() => {
    cleanup();
    mocks.from.mockClear();
  });

  it("editable bublina nezobrazí tečku a nečte frontu is_new", async () => {
    render(<MemoryRouter><ProfileAvatarBubble userId="fresh-user" editable /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Upravit avatara" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nové položky odemčeny")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.from).toHaveBeenCalledWith("avatar_profiles"));
    expect(mocks.from).not.toHaveBeenCalledWith("user_avatar_items");
  });
});
