import { describe, expect, it } from "vitest";
import { countSubjectNews, formatNewsCount, newsKindOf, newsLabel } from "./subject-news";

const now = new Date("2026-11-21T12:00:00Z");
const at = (d: string) => ({ created_at: d });

describe("subject-news", () => {
  it("rozliší zeď, materiál, úkol a test", () => {
    expect(newsKindOf({ settings: { kind: "announcement" } })).toBe("wall");
    expect(newsKindOf({ settings: { kind: "material" } })).toBe("material");
    expect(newsKindOf({ settings: {} })).toBe("task");
    expect(newsKindOf({ settings: {}, exam_type: "test" })).toBe("test");
  });
  it("počítá jen položky po poslední návštěvě", () => {
    const seen = new Date("2026-11-20T00:00:00Z").getTime();
    const r = countSubjectNews([at("2026-11-19T10:00:00Z"), at("2026-11-20T10:00:00Z"), { ...at("2026-11-21T08:00:00Z"), settings: { kind: "material" } }], seen, now);
    expect(r).toEqual({ wall: 0, material: 1, task: 1, test: 0, total: 2 });
  });
  it("při první návštěvě počítá jen posledních 14 dní", () => {
    expect(countSubjectNews([at("2026-11-01T00:00:00Z"), at("2026-11-10T00:00:00Z")], null, now).total).toBe(1);
  });
  it("naplánovaný úkol se počítá od zveřejnění, budoucí ne", () => {
    const seen = new Date("2026-11-20T00:00:00Z").getTime();
    expect(countSubjectNews([{ created_at: "2026-11-01T00:00:00Z", scheduled_publish_at: "2026-11-21T06:00:00Z" }, { created_at: "2026-11-21T06:00:00Z", scheduled_publish_at: "2026-11-25T00:00:00Z" }], seen, now).total).toBe(1);
  });
  it("strop 99+ a české tvary", () => {
    expect(formatNewsCount(100)).toBe("99+");
    expect(formatNewsCount(7)).toBe("7");
    expect(newsLabel("task", 3)).toBe("3 nové úkoly");
    expect(newsLabel("wall", 1)).toBe("1 nový příspěvek na zdi");
  });
});
