import { describe, it, expect } from "vitest";
import { worksheetGoesToPortfolio, studentPlayerBranch } from "@/lib/assignment-kind";
describe("portfolio + pracovní list", () => {
  it("úkol s listem a portfoliem vloží list do portfolia", () => expect(worksheetGoesToPortfolio("task", true, "ws")).toBe(true));
  it("úkol s listem bez portfolia do portfolia nejde", () => expect(worksheetGoesToPortfolio("task", false, "ws")).toBe(false));
  it("portfolio bez listu nevkládá list", () => expect(worksheetGoesToPortfolio("task", true, null)).toBe(false));
  it("materiál se netýká", () => expect(worksheetGoesToPortfolio("material", true, "ws")).toBe(false));
});

describe("větev žákovského přehrávače", () => {
  it("portfolio + list ukáže list", () => expect(studentPlayerBranch("task", true, true)).toBe("worksheet"));
  it("portfolio bez listu ukáže přílohy", () => expect(studentPlayerBranch("task", true, false)).toBe("portfolio"));
  it("list bez portfolia ukáže list", () => expect(studentPlayerBranch("task", false, true)).toBe("worksheet"));
  it("materiál zůstává materiálem", () => expect(studentPlayerBranch("material", true, true)).toBe("material"));
  it("bez listu i portfolia otázky", () => expect(studentPlayerBranch("task", false, false)).toBe("questions"));
});
