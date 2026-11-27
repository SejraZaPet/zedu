import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { isPollPublished, usesCompactProjectorLayout } from "@/lib/projector-compact-layout";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })), removeChannel: vi.fn() },
}));
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver = RO;
import ProjectorSlideView from "@/components/live/ProjectorSlideView";

const slide: any = {
  slideId: "poll-test", type: "activity", blocks: [], projector: { headline: "[TEST] Anketa" },
  activitySpec: { activityType: "poll", question: "[TEST] Která?", options: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }] },
};
const view = (settings: any) => (
  <ProjectorSlideView sessionId="s" session={{ title: "[TEST]", status: "playing", settings }}
    currentSlide={slide} currentIndex={0} slides={[slide]} players={[{}, {}]} gameCode="TEST" />
);

describe("anketa na projektoru", () => {
  it("zveřejnění platí jen pro aktuální snímek", () => {
    expect(isPollPublished({ pollPublished: true, pollPublishedQuestion: 0 }, 0)).toBe(true);
    expect(isPollPublished({ pollPublished: true, pollPublishedQuestion: 1 }, 0)).toBe(false);
    expect(usesCompactProjectorLayout("poll", {}, 0)).toBe(false);
  });

  it("po zveřejnění vykreslí výsledky s počty hlasů", async () => {
    rpc.mockResolvedValue({ data: [{ answer: { selectedOptions: ["0"] } }, { answer: { selectedOptions: ["0"] } }] });
    render(view({ pollPublished: true, pollPublishedQuestion: 0 }));
    expect(await screen.findByText("2 hlasů z 2 žáků")).toBeInTheDocument();
    expect(screen.getAllByTestId("poll-projector-row")).toHaveLength(4);
    expect(screen.getByTestId("compact-activity-question")).toHaveTextContent("[TEST] Která?");
  });

  it("před zveřejněním výsledky nevykreslí", () => {
    rpc.mockResolvedValue({ data: [] });
    render(view({}));
    expect(screen.queryByTestId("poll-projector-results")).not.toBeInTheDocument();
  });
});
