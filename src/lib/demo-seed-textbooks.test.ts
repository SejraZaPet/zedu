import { describe, it, expect } from "vitest";
import { textbookOwnerOr } from "./demo-seed-textbooks";

describe("textbookOwnerOr", () => {
  it("běžný učitel vidí jen vlastní učebnice", () => {
    expect(textbookOwnerOr("u1", false)).toBe("teacher_id.eq.u1");
  });
  it("demo učitel vidí i ukázkové učebnice", () => {
    expect(textbookOwnerOr("u1", true)).toBe("teacher_id.eq.u1,is_demo_seed.eq.true");
  });
});
