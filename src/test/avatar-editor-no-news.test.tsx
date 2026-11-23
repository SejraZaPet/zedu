import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), toast: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "fresh-user" }, loading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "avatar_items") {
        const item = {
          id: "base-1", slug: "base_01", name: "Základní postava", category: "base", rarity: "common",
          image_url: null, icon_name: "User", image_url_back: null, thumbnail_url: null, color_value: null,
          is_neutral_color: false, layer_slot: null, recommended_for_role: "both", unlock_type: "default",
          unlock_value: null, is_default: true, is_active: true, sort_order: 1,
          layer_offset_x: 0, layer_offset_y: 0, layer_scale: 1,
        };
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [item], error: null }) }) }) };
      }
      if (table === "user_avatar_items") {
        return {
          select: () => ({ eq: async () => ({
            data: [{ avatar_item_id: "base-1", is_new: true, is_favorite: false }], error: null,
          }) }),
          update: (patch: Record<string, unknown>) => {
            mocks.update(patch);
            return { eq: () => ({ eq: async () => ({ error: null }) }) };
          },
        };
      }
      if (table === "avatar_profiles") {
        const profile = {
          user_id: "fresh-user", base_id: "base-1", background_id: null, frame_id: null, badge_id: null,
          reduce_motion: false,
        };
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) };
      }
      throw new Error(`Neočekávaná tabulka: ${table}`);
    },
  },
}));

import AvatarEditor from "@/pages/AvatarEditor";

describe("Editor avatara bez novinek", () => {
  beforeEach(() => mocks.update.mockClear());
  afterEach(() => cleanup());

  it("nový uživatel se všemi is_new=true otevře editor bez štítků a úvodního dialogu", async () => {
    render(<MemoryRouter><AvatarEditor /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Editor avatara" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Základní postava" })).toBeInTheDocument();
    expect(screen.queryByText("NOVÉ")).not.toBeInTheDocument();
    expect(screen.queryByText("Nová položka odemčena!")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("oblíbené položky fungují dál a neposílají změnu is_new", async () => {
    render(<MemoryRouter><AvatarEditor /></MemoryRouter>);

    const favorite = await screen.findByRole("button", { name: "Přidat do oblíbených" });
    fireEvent.click(favorite);

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ is_favorite: true }));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("is_new");
    expect(screen.getByRole("button", { name: "Náhodný vzhled" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Oblíbené" })).toBeEnabled();
  });
});
