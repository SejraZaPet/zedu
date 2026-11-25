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
    fireEvent.click(screen.getByLabelText("Skrýt oznámení"));
    expect(screen.queryByAltText("Testovací banner")).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).not.toBeNull();
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Novinky/ })); });
    expect(screen.getByAltText("Testovací banner")).toBeTruthy();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("skrytí vydrží po znovuotevření přehledu (remount)", () => {
    const first = render(<DashboardBanners />);
    fireEvent.click(screen.getByLabelText("Skrýt oznámení"));
    first.unmount();
    render(<DashboardBanners />);
    expect(screen.queryByAltText("Testovací banner")).toBeNull();
  });

  it("křížek skryje celý pás, i když se střídá více bannerů", () => {
    state.data = [banner, { ...banner, id: "b2", alt_text: "Druhý" }];
    render(<DashboardBanners />);
    fireEvent.click(screen.getByLabelText("Skrýt oznámení"));
    expect(screen.queryByAltText("Druhý")).toBeNull();
    expect(screen.queryByRole("region", { name: "Oznámení" })).toBeNull();
  });

  it("nový banner s jiným id se po skrytí ukáže", () => {
    const first = render(<DashboardBanners />);
    fireEvent.click(screen.getByLabelText("Skrýt oznámení"));
    first.unmount();
    state.data = [banner, { ...banner, id: "b3", alt_text: "Nový" }];
    render(<DashboardBanners />);
    expect(screen.getByAltText("Nový")).toBeTruthy();
    expect(screen.queryByAltText("Testovací banner")).toBeNull();
  });

  it("číslo u Novinek: počet nových, po skrytí klesne, po otevření zmizí", () => {
    state.data = [banner, { ...banner, id: "b2", alt_text: "Druhý" }];
    render(<><BannersNewsButton /><DashboardBanners /></>);
    expect(screen.getByRole("button", { name: "Novinky, 2 nové" })).toBeTruthy();
    expect(screen.getByTestId("news-count").textContent).toBe("2");
    fireEvent.click(screen.getByLabelText("Skrýt oznámení"));
    expect(screen.queryByTestId("news-count")).toBeNull();
    expect(screen.queryByAltText("Druhý")).toBeNull();
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Novinky" })); });
    expect(screen.getByAltText("Druhý")).toBeTruthy();
    expect(screen.queryByTestId("news-count")).toBeNull();
  });

  it("po kliknutí na Novinky se číslo už neukáže ani po remountu", () => {
    const first = render(<BannersNewsButton />);
    expect(screen.getByRole("button", { name: "Novinky, 1 nová" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novinky/ }));
    first.unmount();
    render(<BannersNewsButton />);
    expect(screen.getByRole("button", { name: "Novinky" })).toBeTruthy();
    expect(screen.queryByTestId("news-count")).toBeNull();
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
