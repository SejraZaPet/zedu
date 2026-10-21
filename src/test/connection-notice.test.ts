import { describe, it, expect } from "vitest";
import { shouldAnnounceRestore } from "@/lib/connection-notice";

describe("connection restored notice", () => {
  it("does not announce without an outage", () => {
    expect(shouldAnnounceRestore(null, 10_000)).toBe(false);
  });
  it("does not announce a short reconnect (under 3 s)", () => {
    expect(shouldAnnounceRestore(1_000, 3_500)).toBe(false);
  });
  it("announces after a real outage of 3 s or more", () => {
    expect(shouldAnnounceRestore(1_000, 4_000)).toBe(true);
  });
});
