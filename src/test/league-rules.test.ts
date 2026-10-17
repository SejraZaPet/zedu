import { describe, it, expect } from "vitest";
import { awardedXp, weekResult, classAverage, visibleRows, tierName } from "@/lib/league-rules";

const base = { previousSameToday: 0, todaySum: 0, streak: 1, firstEventToday: false };

describe("Bezli liga – pravidla", () => {
  it("denní strop 150 XP", () => {
    expect(awardedXp({ ...base, base: 20, todaySum: 140 })).toBe(10);
    expect(awardedXp({ ...base, base: 20, todaySum: 150 })).toBe(0);
  });
  it("klesající zisk za opakování 10, 5, 2, 0", () => {
    expect([0, 1, 2, 3, 4].map((n) => awardedXp({ ...base, base: 10, previousSameToday: n }))).toEqual([10, 5, 2, 0, 0]);
  });
  it("bonus za sérii jen u prvního zápisu dne", () => {
    expect(awardedXp({ ...base, base: 10, streak: 3, firstEventToday: true })).toBe(15);
    expect(awardedXp({ ...base, base: 10, streak: 7, firstEventToday: true })).toBe(20);
    expect(awardedXp({ ...base, base: 10, streak: 7, firstEventToday: false })).toBe(10);
    expect(awardedXp({ ...base, base: 10, streak: 2, firstEventToday: true })).toBe(10);
  });
  it("postup top 5, sestup posledních 5 ve skupině od 10", () => {
    expect(weekResult(5, 30, 40, 0)).toBe("promoted");
    expect(weekResult(1, 30, 0, 0)).toBe("stay");
    expect(weekResult(1, 30, 99, 3)).toBe("promoted" === weekResult(1, 30, 99, 3) ? "promoted" : "stay");
    expect(weekResult(26, 30, 5, 1)).toBe("demoted");
    expect(weekResult(26, 30, 5, 0)).toBe("stay");
    expect(weekResult(9, 9, 0, 2)).toBe("stay");
  });
  it("Diamant už nepostupuje", () => {
    expect(weekResult(1, 30, 99, 3)).toBe("stay");
    expect(tierName(3)).toBe("Diamant");
  });
  it("body třídy = průměr aktivních členů", () => {
    expect(classAverage([30, 0, 10, 0])).toBe(20);
    expect(classAverage([0, 0])).toBe(0);
  });
  it("žák nevidí cizí slabé výsledky", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ rank: i + 1, xp: 20 - i, isMe: i === 17 }));
    rows[8].xp = 0;
    const v = visibleRows(rows);
    expect(v.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 18]);
  });
});
