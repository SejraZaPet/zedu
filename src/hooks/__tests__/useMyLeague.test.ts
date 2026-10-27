import { describe, it, expect } from "vitest";
import { showLeagueMenu } from "../useMyLeague";

describe("showLeagueMenu", () => {
  it("shows for ok, opted_out and no_grade", () => {
    expect(showLeagueMenu("ok")).toBe(true);
    expect(showLeagueMenu("opted_out")).toBe(true);
    expect(showLeagueMenu("no_grade")).toBe(true);
  });
  it("hides for disabled, demo and unknown", () => {
    expect(showLeagueMenu("disabled")).toBe(false);
    expect(showLeagueMenu("demo")).toBe(false);
    expect(showLeagueMenu(null)).toBe(false);
  });
});
