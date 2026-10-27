import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { excludePreviewStudents } from "@/lib/preview-students";
import { visibilityFlags } from "@/lib/schedule-exception-store";

describe("schedule change visibility", () => {
  it("defaults to showing the change and the reason", () => {
    expect(visibilityFlags(undefined, undefined)).toEqual({ share: true, reasonVisible: true });
  });
  it("hiding the change also hides the reason", () => {
    expect(visibilityFlags(false, true)).toEqual({ share: false, reasonVisible: false });
  });
  it("change can be shown without the reason", () => {
    expect(visibilityFlags(true, false)).toEqual({ share: true, reasonVisible: false });
  });
});

describe("excludePreviewStudents", () => {
  it("removes preview student ids from rosters", () => {
    expect(excludePreviewStudents(["a", "p", "b"], (x) => x, ["p"])).toEqual(["a", "b"]);
  });
  it("keeps everyone when there is no preview student", () => {
    expect(excludePreviewStudents(["a", "b"], (x) => x, [])).toEqual(["a", "b"]);
  });
});
