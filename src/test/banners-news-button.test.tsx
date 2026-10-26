import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const state: { data: any[] | undefined } = { data: [] };
vi.mock("@/hooks/useMyBanners", () => ({
  useMyBanners: () => ({ data: state.data, isLoading: false }),
}));

import DashboardBanners from "@/components/dashboard/DashboardBanners";
import BannersNewsButton, { restoreDismissedBanners } from "@/components/dashboard/BannersNewsButton";
import { DISMISS_KEY } from "@/lib/banners";

const banner = {
  id: "b1", title: "[TEST]", media_type: "image", image_path: "https://x/a.png", video_path: null,
  poster_path: null, alt_text: "Testovací banner", link_url: null, display_seconds: 6,
  starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + 86400000).toISOString(),
};

describe("Novinky button", () => {
  beforeEach(() => { localStorage.clear(); state.data = [banner]; });

  it("re-shows banner after dismissing with ×", () => {
    render(<><BannersNewsButton /><DashboardBanners /></>);
    fireEvent.click(screen.getByLabelText("Skrýt oznámení na 7 dní"));
    expect(screen.queryByAltText("Testovací banner")).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).not.toBeNull();
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Novinky/ })); });
    expect(screen.getByAltText("Testovací banner")).toBeTruthy();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("is not rendered without active banners", () => {
    state.data = [];
    render(<BannersNewsButton />);
    expect(screen.queryByRole("button", { name: /Novinky/ })).toBeNull();
  });

  it("does not crash when localStorage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => restoreDismissedBanners()).not.toThrow();
    render(<BannersNewsButton />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /Novinky/ }))).not.toThrow();
    spy.mockRestore();
  });
});
