import { describe, it, expect } from "vitest";
import { decideRemoteActivityCmd, remoteActivityState } from "@/lib/remote-activity";

const act = (activityType: string) => ({ type: "activity", activitySpec: { activityType, question: "Q" } });
const decide = (cmd: string, slide: any, settings: any, i = 2) =>
  decideRemoteActivityCmd(cmd, remoteActivityState(slide, settings, i, "playing"));

describe("dálkové ovládání: start a publish", () => {
  it("start spustí jen aktivitu čekající na Spustit", () => {
    expect(decide("start", act("poll"), { armedQuestion: 2 })).toEqual({ type: "start" });
    expect(decide("start", act("poll"), {})).toBeNull(); // už běží → žádný dvojí start
  });

  it("publish volá zveřejnění podle typu", () => {
    expect(decide("publish", act("poll"), {})).toEqual({ type: "publish", kind: "poll" });
    expect(decide("publish", act("wall"), {})).toEqual({ type: "publish", kind: "wall" });
    expect(decide("publish", act("mcq"), {})).toEqual({ type: "publish", kind: "mcq" });
    expect(decide("publish", act("wordcloud"), { wordcloudPublished: false, wordcloudPublishedQuestion: 2 }))
      .toEqual({ type: "publish", kind: "wordcloud" });
  });

  it("publish je idempotentní a před spuštěním se ignoruje", () => {
    expect(decide("publish", act("poll"), { pollPublished: true, pollPublishedQuestion: 2 })).toBeNull();
    expect(decide("publish", act("wall"), { wallPublished: true, wallPublishedQuestion: 2 })).toBeNull();
    expect(decide("publish", act("mcq"), { mcqRevealedQuestion: 2 })).toBeNull();
    expect(decide("publish", act("poll"), { armedQuestion: 2 })).toBeNull();
    // Zveřejnění jiného slidu neplatí pro aktuální.
    expect(decide("publish", act("poll"), { pollPublished: true, pollPublishedQuestion: 1 })).toEqual({ type: "publish", kind: "poll" });
  });

  it("neaktivitní slide příkazy ignoruje", () => {
    const slide = { type: "content", projector: { headline: "Úvod" } };
    expect(decide("start", slide, { armedQuestion: 2 })).toBeNull();
    expect(decide("publish", slide, {})).toBeNull();
    expect(decideRemoteActivityCmd("start", remoteActivityState(act("poll"), { armedQuestion: 2 }, 2, "lobby"))).toBeNull();
  });
});
