import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signing = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notebook", () => ({ signNotebookImages: signing }));
import NotebookImageContent from "@/components/notebook/NotebookImageContent";

beforeEach(() => { signing.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("notebook background recovery", () => {
  it("signs again once after image failure and permits a manual retry", async () => {
    signing.mockResolvedValueOnce({ "student/page.jpg": "/expired.jpg" })
      .mockResolvedValueOnce({ "student/page.jpg": "/fresh.jpg" })
      .mockResolvedValueOnce({ "student/page.jpg": "/manual.jpg" });
    render(<NotebookImageContent path="student/page.jpg" locked />);
    const image = await screen.findByRole("img");
    fireEvent.error(image);
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "/fresh.jpg"));
    fireEvent.error(screen.getByRole("img"));
    await screen.findByRole("alert");
    expect(signing).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "/manual.jpg"));
    fireEvent.load(screen.getByRole("img"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("retries signing errors only once instead of leaving an endless placeholder", async () => {
    signing.mockRejectedValue(new Error("unavailable"));
    render(<NotebookImageContent path="student/page.jpg" locked />);
    await screen.findByRole("alert");
    expect(signing).toHaveBeenCalledTimes(2);
    expect(signing).toHaveBeenLastCalledWith(["student/page.jpg"], { strict: true });
  });

  it("refreshes before the 3600-second signed link expires", async () => {
    vi.useFakeTimers();
    signing.mockResolvedValue({ "student/page.jpg": "/fresh.jpg" });
    render(<NotebookImageContent path="student/page.jpg" locked />);
    await act(async () => {});
    fireEvent.load(screen.getByRole("img"));
    await act(async () => { vi.advanceTimersByTime(55 * 60 * 1000); });
    expect(signing).toHaveBeenCalledTimes(2);
  });
});