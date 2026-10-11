import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── In-memory mock: notebook_pages + storage ──
type Row = Record<string, any>;
const db: { pages: Row[]; uploads: { bucket: string; path: string }[] } = { pages: [], uploads: [] };
const WS_SPEC = {
  version: "1", header: { title: "Česká gastronomie" }, metadata: {}, renderConfig: { includeAnswerKey: true },
  variants: [{ variantId: "A", items: [] }], answerKeys: { A: [{ itemId: "q1", correctAnswer: "TAJNY_KLIC" }] },
};
function get(r: Row, k: string) {
  if (k.startsWith("content->worksheet->>")) return r.content?.worksheet?.[k.split("->>")[1]];
  return r[k];
}
function query(table: string) {
  const f: [string, any][] = [];
  let op = "select"; let payload: Row = {}; let single = false;
  const api: any = {
    select: () => api, order: () => api, limit: () => api, not: () => api,
    eq: (k: string, v: any) => (f.push([k, v]), api),
    insert: (p: Row) => ((op = "insert"), (payload = p), api),
    single: () => ((single = true), api), maybeSingle: () => ((single = true), api),
    then: (res: any) => {
      if (table === "worksheets") return Promise.resolve({ data: { spec: WS_SPEC, title: "Česká gastronomie", subject: "Gastronomie" }, error: null }).then(res);
      if (op === "insert") {
        const row = { id: `p${db.pages.length + 1}`, ...payload };
        db.pages.push(row);
        return Promise.resolve({ data: row, error: null }).then(res);
      }
      const rows = db.pages.filter((r) => f.every(([k, v]) => get(r, k) === v));
      return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(res);
    },
  };
  return api;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => query(t),
    storage: { from: (bucket: string) => ({ upload: async (path: string) => (db.uploads.push({ bucket, path }), { error: null }) }) },
  },
}));

import LayoutBlockItem from "@/components/worksheet-items/LayoutBlockItem";
import { scoreWorksheet, isItemAnswered, MANUAL_ITEM_TYPES } from "@/components/WorksheetPlayer";
import { insertWorksheetIntoNotebook, snapshotPenPagesForAttempt, readSnapshot, SNAPSHOT_KEY } from "@/lib/worksheet-notebook";
import { normalizeContent } from "@/lib/notebook";
import { buildStudentWorksheetHtml } from "@/lib/worksheet-pdf-export";
import { WORKSHEET_SPEC_EXAMPLE } from "@/lib/worksheet-spec";

const base = { points: 2, answerSpace: { type: "lines", lineCount: 3, heightMm: 22 } } as any;
const wl = { ...base, id: "wl", type: "write_lines", prompt: "Napiš recept", lineCount: 3 };
const tb = { ...base, id: "tb", type: "two_boxes", prompt: "", leftTitle: "Teplé", rightTitle: "Studené", leftContent: "lines:2", rightContent: "lines:2" };

beforeEach(() => { db.pages = []; db.uploads = []; });

describe("psaní do linek a polí", () => {
  it("write_lines ukládá text pod item.id", () => {
    const onChange = vi.fn();
    render(<LayoutBlockItem item={wl} value={undefined} onChange={onChange} disabled={false} showResults={false} />);
    fireEvent.change(screen.getByLabelText("Napiš recept"), { target: { value: "Svíčková" } });
    expect(onChange).toHaveBeenCalledWith("Svíčková");
  });

  it("two_boxes ukládá obě pole zvlášť a obnoví je", () => {
    const onChange = vi.fn();
    render(<LayoutBlockItem item={tb} value={["", "Chlebíček"]} onChange={onChange} disabled={false} showResults={false} />);
    expect((screen.getByLabelText("Studené") as HTMLTextAreaElement).value).toBe("Chlebíček");
    fireEvent.change(screen.getByLabelText("Teplé"), { target: { value: "Guláš" } });
    expect(onChange).toHaveBeenCalledWith(["Guláš", "Chlebíček"]);
  });

  it("editor (disabled bez hodnoty) ukazuje jen statické linky", () => {
    const { container } = render(<LayoutBlockItem item={wl} value={undefined} onChange={() => {}} disabled showResults={false} />);
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("nezapočítá se do automatického skóre, vyplněno jen s textem", () => {
    const res = scoreWorksheet([wl, tb], { wl: "x", tb: ["a", "b"] }, [{ itemId: "wl", correctAnswer: "x" } as any]);
    expect(res.score).toBe(0);
    expect(MANUAL_ITEM_TYPES).toEqual(expect.arrayContaining(["write_lines", "two_boxes"]));
    expect(isItemAnswered(tb, ["", " "])).toBe(false);
    expect(isItemAnswered(tb, ["", "b"])).toBe(true);
    expect(isItemAnswered(wl, "")).toBe(false);
  });
});

describe("vložení do sešitu", () => {
  const nb = { id: "nb1", owner_id: "s1", subject: "Gastronomie" };

  it("PDF pro pero: stránky s názvem, oddílem a zamčeným pozadím; podruhé bez duplicit", async () => {
    const render = vi.fn(async () => [new Blob(["a"]), new Blob(["b"])]);
    const res = await insertWorksheetIntoNotebook({ notebook: nb, worksheetId: "ws1", mode: "pen", render });
    expect(res.pages).toHaveLength(2);
    expect(res.pages[0].title).toBe("Česká gastronomie (1/2)");
    expect(res.pages[0].section).toBe("Gastronomie");
    const c = normalizeContent(db.pages[0].content);
    expect(c.images[0]).toMatchObject({ x: 0, y: 0, w: 1, h: 1, locked: true });
    expect(c.worksheet).toMatchObject({ worksheetId: "ws1", mode: "pen" });
    expect(db.uploads[0].path.startsWith("s1/")).toBe(true);
    const again = await insertWorksheetIntoNotebook({ notebook: nb, worksheetId: "ws1", mode: "pen", render });
    expect(again.existed).toBe(true);
    expect(db.pages).toHaveLength(2);
  });

  it("Digitálně: jedna stránka s odkazem, bez kopie odpovědí", async () => {
    const res = await insertWorksheetIntoNotebook({ notebook: nb, worksheetId: "ws1", mode: "digital", assignmentId: "as1" });
    const c = normalizeContent(db.pages[0].content);
    expect(res.pages).toHaveLength(1);
    expect(c.worksheet).toMatchObject({ mode: "digital", assignmentId: "as1" });
    expect(c.strokes).toEqual([]);
  });

  it("snapshot při odevzdání: kopie do složky úkolu/žáka", async () => {
    const pages = [{ id: "p1", title: "Česká gastronomie", content: { strokes: [], textBoxes: [], images: [] } }] as any;
    const snap = await snapshotPenPagesForAttempt({
      worksheetId: "ws1", assignmentId: "as1", studentId: "s1", attemptId: "at1", pages, rasterize: async () => new Blob(["x"]),
    });
    expect(snap?.pages[0].path.startsWith("as1/s1/notebook-at1-")).toBe(true);
    expect(db.uploads[0].bucket).toBe("assignment-uploads");
    expect(readSnapshot({ [SNAPSHOT_KEY]: snap })?.pages).toHaveLength(1);
    expect(await snapshotPenPagesForAttempt({ worksheetId: "ws1", assignmentId: "as1", studentId: "s1", attemptId: "at1", pages: [] })).toBeNull();
  });
});

describe("žákovský tisk", () => {
  it("vytiskne napsaný text, ale nikdy klíč odpovědí", async () => {
    const v = WORKSHEET_SPEC_EXAMPLE.variants[0];
    const spec = { ...WORKSHEET_SPEC_EXAMPLE, variants: [{ ...v, items: [...v.items, { ...wl, itemNumber: 99 }] }] } as any;
    const html = await buildStudentWorksheetHtml(spec, "ws1", { wl: "Svíčková na smetaně" });
    expect(html).toContain("Svíčková na smetaně");
    expect(html).not.toContain(`class="ws-key-item"`);
  });
});
