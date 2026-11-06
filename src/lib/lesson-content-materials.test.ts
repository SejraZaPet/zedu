import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { parseMaterials } from "./assignment-materials";
import { addContentMaterial, parseLessonMaterials, splitLessonMaterials } from "./lesson-content-materials";

const link = { id: "l1", kind: "link", title: "Video", url: "https://x.cz" };
const file = { id: "f1", kind: "file", title: "a.pdf", path: "t/a.pdf" };
const content = { id: "c1", kind: "content", contentType: "worksheet", refId: "w1", title: "List" };

describe("materiály hodiny", () => {
  it("úkoly (parseMaterials) nový druh content i neznámé druhy přeskočí, staré ponechají", () => {
    expect(parseMaterials([link, file, content, { kind: "weird" }]).map((m) => m.id)).toEqual(["l1", "f1"]);
  });
  it("hodina přečte odkaz, soubor i položku knihovny, neznámé přeskočí", () => {
    const r = parseLessonMaterials([link, content, { kind: "weird" }, { kind: "content", contentType: "activity", refId: "a" }, file]);
    expect(r.map((m) => m.id)).toEqual(["l1", "c1", "f1"]);
    const parts = splitLessonMaterials(r);
    expect(parts.basic).toHaveLength(2);
    expect(parts.content).toHaveLength(1);
  });
  it("stejný obsah se nepřidá dvakrát", () => {
    const one = addContentMaterial([], { contentType: "lesson", refId: "x", title: "L" }, "id1");
    expect(addContentMaterial(one, { contentType: "lesson", refId: "x", title: "L" })).toHaveLength(1);
    expect(one[0]).toMatchObject({ id: "id1", kind: "content", contentType: "lesson", refId: "x" });
  });
});
