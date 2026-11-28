import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSourceBundle } from "@/lib/use-source-bundle";
import { AUDIO_VIDEO_SOURCE_MESSAGE, bundleState, checkAddBatch, kindForFile } from "@/lib/source-bundle";
import { assignmentAttachmentRefs } from "@/lib/grading-feedback";
import { validateMaterialFile } from "@/lib/assignment-materials";
import { sanitizeAttachmentRefs } from "../../supabase/functions/suggest-grading-feedback/prompt";

vi.mock("@/lib/source-extract", () => ({ extractFileSource: vi.fn(async () => "[TEST] učivo. ".repeat(20)) }));
const file = (name: string, type = "") => new File(["[TEST]"], name, { type });

describe("sdílené dávky zdrojů", () => {
  it("smíšené dokumenty a fotky zůstávají ve vybraném pořadí", async () => {
    const hook = renderHook(() => useSourceBundle());
    act(() => { hook.result.current.addFiles([file("[TEST].docx"), file("[TEST].jpg", "image/jpeg"), file("[TEST].odp")]); });
    await waitFor(() => expect(hook.result.current.state.ok).toBe(true));
    expect(hook.result.current.items.map((i) => i.kind)).toEqual(["docx", "photo", "odt"]);
  });
  it("dva výběry v jednom okamžiku nepřekročí čtyři dokumenty", async () => {
    const reject = vi.fn();
    const hook = renderHook(() => useSourceBundle("teacher", reject));
    act(() => {
      hook.result.current.addFiles(Array.from({ length: 4 }, (_, i) => file(`[TEST]${i}.docx`)));
      expect(hook.result.current.addFiles([file("[TEST]navíc.docx")])).toBe(false);
    });
    expect(hook.result.current.items).toHaveLength(4);
    expect(reject).toHaveBeenCalledOnce();
    await waitFor(() => expect(hook.result.current.state.busy).toBe(false));
  });
  it("respektuje původní limity 6 000 a 8 000 znaků bez ořezu", () => {
    const item = { id: "[TEST]", kind: "text" as const, status: "ready" as const, label: "[TEST]", text: "x".repeat(6001) };
    expect(bundleState([item], "teacher", { maxChars: 6000 }).ok).toBe(false);
    expect(bundleState([item], "teacher", { maxChars: 6000 }).text).toHaveLength(6001);
    expect(bundleState([{ ...item, text: "x".repeat(8001) }], "student").ok).toBe(false);
  });
});

describe("audio a video pouze jako příloha", () => {
  it.each(["mp3", "mp4", "m4a", "wav", "mov", "webm"])("%s se nikdy nezařadí do AI, příloha zůstává povolená", (ext) => {
    const media = file(`[TEST].${ext}`);
    expect(kindForFile(media)).toBeNull();
    expect(checkAddBatch([], [{ kind: null, name: media.name }])).toBe(AUDIO_VIDEO_SOURCE_MESSAGE);
    expect(validateMaterialFile(media)).toBeNull();
    const ref = { file_name: media.name, file_path: `owner/${media.name}`, file_type: media.type };
    expect(assignmentAttachmentRefs([ref])).toEqual([]);
    expect(sanitizeAttachmentRefs([{ path: ref.file_path, name: ref.file_name, type: ref.file_type }])).toEqual([]);
  });
  it("MIME audio/video má přednost i před příponou PDF", () => {
    expect(kindForFile(file("[TEST].pdf", "audio/mpeg"))).toBeNull();
    expect(sanitizeAttachmentRefs([{ path: "owner/[TEST].pdf", name: "[TEST].pdf", type: "video/mp4" }])).toEqual([]);
  });
});