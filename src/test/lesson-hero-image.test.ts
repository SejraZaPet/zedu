import { describe, expect, it } from "vitest";
import { HERO_IMAGE_CLASS } from "@/lib/image-block-layout";

describe("hero banner lekce", () => {
  it("má pevný poměr stran a jednotný ořez nezávislý na šířce rodiče", () => {
    expect(HERO_IMAGE_CLASS).toContain("aspect-[19/5]");
    expect(HERO_IMAGE_CLASS).toContain("w-full");
    expect(HERO_IMAGE_CLASS).toContain("object-cover");
    expect(HERO_IMAGE_CLASS).not.toContain("max-h-");
  });
});