import { describe, it, expect } from "vitest";
import { canPublishToMaterialsOnly, materialsOnlyPublishPatch, PUBLISH_MATERIALS_ONLY_TOAST } from "./worksheet-publish-menu";

describe("publikace listu jen do materiálů", () => {
  it("nabízí se jen u konceptu", () => {
    expect(canPublishToMaterialsOnly("draft")).toBe(true);
    expect(canPublishToMaterialsOnly("published")).toBe(false);
    expect(canPublishToMaterialsOnly("scheduled")).toBe(false);
  });
  it("mění jen stav, bez úkolu a příjemců", () => {
    expect(materialsOnlyPublishPatch()).toEqual({ status: "published", scheduled_publish_at: null });
  });
  it("toast říká, že nic nebylo zadáno", () => {
    expect(PUBLISH_MATERIALS_ONLY_TOAST).toBe("Publikováno do materiálů – žákům nebylo nic zadáno");
  });
});
