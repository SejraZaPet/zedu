import { describe, expect, it } from "vitest";
import { fillLessonVisualImages, teacherMediaPathFromSignedUrl } from "@/lib/worksheet-images";
import { extractVisualBlocksFromBlocks } from "@/lib/lesson-content-splitter";

describe("worksheet images", () => {
  it("parses storage path from signed teacher-media URL", () => {
    expect(
      teacherMediaPathFromSignedUrl("https://x.supabase.co/storage/v1/object/sign/teacher-media/u1/a.png?token=abc"),
    ).toBe("u1/a.png");
    expect(teacherMediaPathFromSignedUrl("https://x/public/lesson-images/a.png")).toBeNull();
  });

  it("fills empty image items from nested lesson images, keeps filled ones", () => {
    const blocks = [{ type: "slide_group", props: { children: [
      { id: "a", type: "image_text", props: { imageUrl: "https://img/1.png", text: "t" } },
    ] } }];
    const visuals = extractVisualBlocksFromBlocks(blocks);
    const items: any[] = [
      { id: "1", type: "image_text", imageUrl: "" },
      { id: "2", type: "image", imageUrl: "" },
      { id: "3", type: "image", imageUrl: "https://keep" },
    ];
    const out = fillLessonVisualImages(items, visuals);
    expect(out[0].imageUrl).toBe("https://img/1.png");
    expect(out[1].imageUrl).toBe("");
    expect(out[2].imageUrl).toBe("https://keep");
  });
});
