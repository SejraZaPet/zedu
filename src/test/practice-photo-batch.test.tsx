import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), prepare: vi.fn(), dispose: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/lib/practice-photo", async (original) => ({ ...(await original<typeof import("@/lib/practice-photo")>()), preparePracticePhoto: mocks.prepare, disposePracticePhoto: mocks.dispose }));
import { usePracticePhotos } from "@/lib/use-practice-photos";
import { MIN_SOURCE_TEXT_LENGTH, SOURCE_TEXT_LIMIT } from "../../supabase/functions/_shared/practice-phases";
const files = (n: number) => Array.from({ length: n }, (_, i) => new File(["photo"], `[TEST] ${i}.jpg`, { type: "image/jpeg" }));
const FIRST = "[TEST] Učivo první stránky. ".repeat(8).trim();
const SECOND = "[TEST] Učivo druhé stránky. ".repeat(8).trim();
describe("practice photo batches", () => {
  beforeEach(() => {
    mocks.prepare.mockImplementation(async (file: File) => ({ imageBase64: file.name, mimeType: "image/jpeg", previewUrl: `blob:${file.name}`, width: 1, height: 1, sizeBytes: 1 }));
    mocks.invoke.mockResolvedValue({ data: { text: FIRST }, error: null });
  });
  afterEach(() => { cleanup(); vi.resetAllMocks(); });
  it("transcribes 2 photos sequentially into one ordered text", async () => {
    const { result } = renderHook(() => usePracticePhotos(vi.fn()));
    await act(() => result.current.add(files(2)));
    let active = 0; let maxActive = 0;
    mocks.invoke.mockImplementation(async (_name, { body }) => {
      active++; maxActive = Math.max(active, maxActive);
      await Promise.resolve(); active--;
      return { data: { text: body.imageBase64.includes("0.jpg") ? FIRST : SECOND }, error: null };
    });
    await act(() => result.current.transcribe());
    expect(result.current.text).toBe(`${FIRST}\n\n${SECOND}`);
    expect(maxActive).toBe(1);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.invoke.mock.calls[0][1].body.mimeType).toBe("image/jpeg");
  });
  it("rejects all 7 photos before preparing or invoking anything", async () => {
    const reject = vi.fn(); const { result } = renderHook(() => usePracticePhotos(reject));
    await act(() => result.current.add(files(7)));
    expect(reject).toHaveBeenCalledTimes(1);
    expect(result.current.entries).toHaveLength(0);
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("rejects a batch exceeding 6 total without losing existing photos", async () => {
    const reject = vi.fn(); const { result } = renderHook(() => usePracticePhotos(reject));
    await act(() => result.current.add(files(5)));
    await act(() => result.current.add(files(2)));
    expect(result.current.entries).toHaveLength(5); expect(reject).toHaveBeenCalledTimes(1);
  });
  it("one failure preserves successful photos and retries only the failed one", async () => {
    const { result } = renderHook(() => usePracticePhotos(vi.fn()));
    await act(() => result.current.add(files(2)));
    mocks.invoke.mockResolvedValueOnce({ data: { text: FIRST }, error: null }).mockResolvedValueOnce({ data: { error: "UNREADABLE_PHOTO" }, error: null });
    await act(() => result.current.transcribe());
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[1].error).toBeTruthy(); expect(result.current.text).toBe(FIRST);
    mocks.invoke.mockResolvedValueOnce({ data: { text: SECOND }, error: null });
    await act(() => result.current.retry(result.current.entries[1].id));
    expect(result.current.text).toBe(`${FIRST}\n\n${SECOND}`); expect(mocks.invoke).toHaveBeenCalledTimes(3);
  });
  it("reorders and removes, revoking only the removed preview and invalidating confirmation", async () => {
    const { result, unmount } = renderHook(() => usePracticePhotos(vi.fn()));
    await act(() => result.current.add(files(2)));
    mocks.invoke.mockResolvedValueOnce({ data: { text: FIRST } }).mockResolvedValueOnce({ data: { text: SECOND } });
    await act(() => result.current.transcribe());
    act(() => result.current.setConfirmed(true));
    act(() => result.current.move(result.current.entries[1].id, -1));
    expect(result.current.text).toBe(`${SECOND}\n\n${FIRST}`); expect(result.current.confirmed).toBe(false);
    const removed = result.current.entries[0].photo;
    act(() => result.current.remove(result.current.entries[0].id));
    expect(result.current.text).toBe(FIRST); expect(mocks.dispose).toHaveBeenCalledWith(removed);
    unmount(); expect(mocks.dispose).toHaveBeenCalledTimes(2);
  });
  it("does not truncate combined text above 8000 characters", async () => {
    const { result } = renderHook(() => usePracticePhotos(vi.fn()));
    await act(() => result.current.add(files(2)));
    mocks.invoke.mockResolvedValue({ data: { text: "X".repeat(4100) } });
    await act(() => result.current.transcribe());
    expect(result.current.text.length).toBe(8202); expect(SOURCE_TEXT_LIMIT).toBe(8000); expect(MIN_SOURCE_TEXT_LENGTH).toBe(150);
  });
  it("guards overlapping batches and discards preparation completed after clear", async () => {
    let finish: ((value: any) => void) | undefined;
    mocks.prepare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => usePracticePhotos(vi.fn()));
    let batch: Promise<void> | undefined;
    act(() => { batch = result.current.add(files(1)); });
    await act(() => result.current.add(files(2)));
    expect(result.current.entries).toHaveLength(1);
    act(() => result.current.clear());
    await act(async () => { finish?.({ previewUrl: "blob:late", imageBase64: "test", mimeType: "image/jpeg" }); await batch; });
    expect(result.current.entries).toHaveLength(0); expect(mocks.dispose).toHaveBeenCalledWith(expect.objectContaining({ previewUrl: "blob:late" }));
  });
});
