import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  GROUP_MIN_HEIGHT,
  getGroupMinHeight,
  groupBlocksIntoSlide,
  setGroupMinHeight,
} from "@/lib/slide-groups";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import type { Block } from "@/lib/textbook-config";

const b = (id: string): Block => ({ id, type: "paragraph", visible: true, props: { text: id } });

describe("ruční výška celého snímku", () => {
  const grouped = groupBlocksIntoSlide([b("p1"), b("p2")], ["p1", "p2"], 2);
  const gid = grouped[0].id;

  it("uloží, omezí a umí zrušit výšku skupiny", () => {
    const next = setGroupMinHeight(grouped, gid, 640);
    expect(getGroupMinHeight(next[0])).toBe(640);
    expect(getGroupMinHeight(setGroupMinHeight(grouped, gid, 10)[0])).toBe(GROUP_MIN_HEIGHT);
    expect(getGroupMinHeight(setGroupMinHeight(next, gid, null)[0])).toBeNull();
  });

  it("žákovské zobrazení použije min-height skupiny", () => {
    const next = setGroupMinHeight(grouped, gid, 500);
    const { container } = render(<LessonBlock block={next[0]} />);
    expect(container.innerHTML).toContain("min-height: 500px");
  });

  it("editor má úchyt pro výšku celého snímku", async () => {
    const { default: BlockEditor } = await import("@/components/admin/BlockEditor");
    const next = setGroupMinHeight(grouped, gid, 480);
    const { getByLabelText, container } = render(<BlockEditor blocks={next} onChange={() => {}} />);
    expect(getByLabelText("Změnit výšku snímku")).toBeTruthy();
    const group = container.querySelector(`[data-block-id="${gid}"]`) as HTMLElement;
    expect(group.style.minHeight).toBe("480px");
  });
});
