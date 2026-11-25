import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LessonBlock from "@/components/LessonBlockRenderer";

const WORDS = "Řešení problémů, přátel, udržovat, nedorozumění, Snaž se, říkají, často, tělo, sdělujeme, vše, obličeje";

describe("table block keeps Czech diacritics", () => {
  it("renders cells unchanged (NFC)", () => {
    const block: any = { id: "t1", type: "table", props: { headers: ["Mezilidské vztahy"], rows: [[WORDS]] } };
    const saved = JSON.parse(JSON.stringify(block));
    const { container } = render(<MemoryRouter><LessonBlock block={saved} blockIndex={0} /></MemoryRouter>);
    const td = container.querySelector("td");
    expect(td?.textContent?.normalize("NFC")).toBe(WORDS.normalize("NFC"));
  });
});
