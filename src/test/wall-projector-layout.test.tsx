import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { isWallPublished, usesCompactProjectorLayout, wallNoteSizing } from "@/lib/projector-compact-layout";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));
import WallProjectorView from "@/components/activities/WallProjectorView";

describe("zeď na projektoru", () => {
  it("kompaktní rozvržení: mrak vždy, zeď jen po zveřejnění na aktuálním snímku", () => {
    expect(usesCompactProjectorLayout("wordcloud", {}, 0)).toBe(true);
    expect(usesCompactProjectorLayout("wall", {}, 0)).toBe(false);
    expect(usesCompactProjectorLayout("wall", { wallPublished: true, wallPublishedQuestion: 2 }, 0)).toBe(false);
    expect(usesCompactProjectorLayout("wall", { wallPublished: true, wallPublishedQuestion: 0 }, 0)).toBe(true);
    expect(usesCompactProjectorLayout("poll", { wallPublished: true, wallPublishedQuestion: 0 }, 0)).toBe(false);
    expect(isWallPublished({ wallPublished: "true", wallPublishedQuestion: 0 }, 0)).toBe(false);
  });

  it("málo odpovědí = větší písmo než mnoho", () => {
    expect(wallNoteSizing(2).fontSize).toBeGreaterThan(wallNoteSizing(6).fontSize);
    expect(wallNoteSizing(6).fontSize).toBeGreaterThan(wallNoteSizing(25).fontSize);
  });

  it("zveřejněná zeď vykreslí všechny lístky", async () => {
    rpc.mockResolvedValue({
      data: Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, answer: { text: `[TEST] ${i}` }, player_id: "p", created_at: "" })),
    });
    render(<WallProjectorView sessionId="s" questionIndex={0} anonymous published projector darkMode={false} />);
    expect(await screen.findByText("[TEST] 5")).toBeInTheDocument();
    expect(screen.getAllByTestId("wall-note")).toHaveLength(6);
  });
});
