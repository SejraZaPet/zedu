import { describe, it, expect } from "vitest";
import {
  buildUserContent, classifyAttachment, hasGradableContent, sanitizeAttachmentRefs, SYSTEM_PROMPT, MAX_FILES,
} from "../../supabase/functions/suggest-grading-feedback/prompt";
import { portfolioAttachmentRefs } from "@/lib/portfolio";

describe("suggest-grading-feedback attachments", () => {
  it("client passes item files and legacy attachment as paths", () => {
    const refs = portfolioAttachmentRefs({
      attachment_url: "u/old.png",
      files: [{ id: "1", portfolio_item_id: "i", file_name: "instagram.pdf", file_url: "u/a.pdf", file_type: "application/pdf", sort_order: 0, created_at: "" }],
    });
    expect(refs).toEqual([
      { path: "u/a.pdf", name: "instagram.pdf", type: "application/pdf" },
      { path: "u/old.png", name: "old.png", type: "" },
    ]);
  });

  it("rejects unsafe paths and caps at 5 files", () => {
    const raw = [{ path: "../x" }, { path: "https://evil" }, { path: "/abs" },
      ...Array.from({ length: 8 }, (_, i) => ({ path: `u/f${i}.pdf` }))];
    const out = sanitizeAttachmentRefs(raw);
    expect(out).toHaveLength(MAX_FILES);
    expect(out[0].path).toBe("u/f0.pdf");
  });

  it("classifies PDF, images, docx and unsupported", () => {
    expect(classifyAttachment("a.PDF").kind).toBe("pdf");
    expect(classifyAttachment("a.jpg").kind).toBe("image");
    expect(classifyAttachment("a.docx").kind).toBe("docx");
    expect(classifyAttachment("a.heic", "image/heic").kind).toBe("unsupported");
  });

  it("PDF attachment is sent as multimodal part and listed, so AI never sees 'no output'", () => {
    const parts = buildUserContent({
      question: "Příspěvek na Instagramu", answerText: "Posílám návrh.",
      attachments: [{ name: "post.pdf", status: "ok", dataUrl: "data:application/pdf;base64,AAA" }],
    });
    expect(parts.some((p) => p.type === "image_url" && p.image_url.url.startsWith("data:application/pdf"))).toBe(true);
    expect((parts[0] as any).text).toContain("Přílohy odevzdané žákem (1)");
    expect(SYSTEM_PROMPT).toContain("NIKDY netvrď, že výstup chybí");
  });

  it("unreadable attachment is reported as unreadable, not missing", () => {
    const parts = buildUserContent({
      question: "Q", answerText: "", attachments: [{ name: "x.pages", status: "unreadable" }],
    });
    expect((parts[0] as any).text).toContain("PŘÍLOHU SE NEPODAŘILO PŘEČÍST");
    expect(parts.some((p) => p.type === "image_url")).toBe(false);
  });

  it("nothing to grade without text and attachments", () => {
    expect(hasGradableContent("  ", [])).toBe(false);
    expect(hasGradableContent("", [{}])).toBe(true);
  });
});
