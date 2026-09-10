import { describe, expect, it } from "vitest";
import { blockBackgroundSlideColor, blockBackgroundStyle } from "@/lib/block-backgrounds";

describe("vlastní barva pozadí bloku", () => {
  it("vlastní barva má přednost před přednastaveným pozadím", () => {
    const style = blockBackgroundStyle({ backgroundStyle: "note", backgroundColor: "#ff8800" });
    expect(style?.background).toBe("#ff8800");
    expect(style?.borderLeft).toBeUndefined();
    expect(blockBackgroundSlideColor({ backgroundColor: "#ff8800" })).toBe("#ff8800");
  });

  it("bez vlastní barvy zůstává přednastavené pozadí", () => {
    expect(blockBackgroundStyle({ backgroundStyle: "note" })?.borderLeft).toContain("solid");
    expect(blockBackgroundStyle({})).toBeUndefined();
  });
});
