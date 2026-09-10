import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  getGroupChildHeight,
  groupBlocksIntoSlide,
  setGroupChildHeight,
  GROUP_CHILD_MIN_HEIGHT,
  getGroupChildren,
} from "@/lib/slide-groups";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import type { Block } from "@/lib/textbook-config";

const b = (id: string): Block => ({ id, type: "paragraph", visible: true, props: { text: id } });

describe("ruční výška karty v režimu Sloupce", () => {
  const grouped = groupBlocksIntoSlide([b("p1"), b("p2")], ["p1", "p2"], 2);
  const gid = grouped[0].id;

  it("uloží a načte výšku karty", () => {
    const next = setGroupChildHeight(grouped, gid, "p1", 320);
    expect(getGroupChildHeight(getGroupChildren(next[0])[0])).toBe(320);
    expect(getGroupChildHeight(getGroupChildren(next[0])[1])).toBeNull();
  });

  it("výšku omezí na minimum a umí ji zrušit", () => {
    const small = setGroupChildHeight(grouped, gid, "p1", 5);
    expect(getGroupChildHeight(getGroupChildren(small[0])[0])).toBe(GROUP_CHILD_MIN_HEIGHT);
    const cleared = setGroupChildHeight(small, gid, "p1", null);
    expect(getGroupChildHeight(getGroupChildren(cleared[0])[0])).toBeNull();
  });

  it("žákovské zobrazení použije minimální výšku", () => {
    const next = setGroupChildHeight(grouped, gid, "p1", 300);
    const { container } = render(<LessonBlock block={next[0]} />);
    const html = container.innerHTML;
    expect(html).toContain("min-height: 300px");
  });
});
