import { describe, it, expect } from "vitest";
import { portfolioHidesWorksheet } from "@/lib/assignment-kind";
describe("portfolio + pracovní list", () => {
  it("úkol s listem a portfoliem je konflikt", () => expect(portfolioHidesWorksheet("task", true, "ws")).toBe(true));
  it("úkol s listem bez portfolia je v pořádku", () => expect(portfolioHidesWorksheet("task", false, "ws")).toBe(false));
  it("portfolio bez listu je v pořádku", () => expect(portfolioHidesWorksheet("task", true, null)).toBe(false));
  it("materiál se netýká", () => expect(portfolioHidesWorksheet("material", true, "ws")).toBe(false));
});
