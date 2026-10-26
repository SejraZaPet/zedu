import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  bannerStatus, dismissBanner, filterDismissed, dismissUntil, isSafeHttpsUrl, bannerErrorMessage, DISMISS_KEY, type Banner,
} from "@/lib/banners";
import {
  validateBannerFile, validateBannerDimensions, validateVideoDuration, validateBannerForm, stalePaths,
} from "@/lib/banner-upload";
import { BannerCarousel } from "@/components/dashboard/DashboardBanners";

const NOW = Date.parse("2026-10-23T10:00:00Z");
const base = { is_active: true, hidden_by_admin: false, starts_at: null, ends_at: null };
const mk = (id: string, extra: Partial<Banner> = {}): Banner => ({
  id, scope: "platform", school_id: null, media_type: "image", image_path: `platform/${id}.jpg`, video_path: null, poster_path: null,
  alt_text: `Banner ${id}`, link_url: null, target_students: true, target_teachers: false, target_leadership: false,
  display_seconds: 6, starts_at: null, ends_at: null, sort_order: 0, is_active: true, hidden_by_admin: false, ...extra,
});

describe("stavy banneru", () => {
  it("rozliší čeká, běží, vypršel, vypnutý, skryto", () => {
    expect(bannerStatus({ ...base, starts_at: "2026-10-24T00:00:00Z" }, NOW)).toBe("ceka");
    expect(bannerStatus(base, NOW)).toBe("bezi");
    expect(bannerStatus({ ...base, ends_at: "2026-10-22T00:00:00Z" }, NOW)).toBe("vyprsel");
    expect(bannerStatus({ ...base, is_active: false }, NOW)).toBe("vypnuty");
    expect(bannerStatus({ ...base, hidden_by_admin: true }, NOW)).toBe("skryto");
  });
});

describe("skrytí křížkem", () => {
  beforeEach(() => localStorage.clear());
  it("skryje na 7 dní", () => {
    dismissBanner("a", null, NOW);
    expect(filterDismissed([{ id: "a" }, { id: "b" }], NOW + 6 * 864e5).map((b) => b.id)).toEqual(["b"]);
    expect(filterDismissed([{ id: "a" }], NOW + 7 * 864e5 + 1).map((b) => b.id)).toEqual(["a"]);
  });
  it("nejdéle do konce platnosti", () => {
    expect(dismissUntil("2026-10-25T10:00:00Z", NOW)).toBe(Date.parse("2026-10-25T10:00:00Z"));
  });
  it("poškozené úložiště nespadne", () => {
    localStorage.setItem(DISMISS_KEY, "{nevalidní");
    expect(filterDismissed([{ id: "a" }], NOW)).toHaveLength(1);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(() => dismissBanner("a", null, NOW)).not.toThrow();
    spy.mockRestore();
  });
});

describe("odkaz", () => {
  it("jen https", () => {
    expect(isSafeHttpsUrl("https://bezli.cz")).toBe(true);
    expect(isSafeHttpsUrl("http://bezli.cz")).toBe(false);
    expect(isSafeHttpsUrl("javascript:alert(1)")).toBe(false);
  });
  it("otevře v nové kartě s noopener noreferrer", () => {
    render(<BannerCarousel banners={[mk("a", { link_url: "https://bezli.cz" })]} />);
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("karusel", () => {
  it("přepne podle display_seconds a při najetí čeká", () => {
    vi.useFakeTimers();
    render(<BannerCarousel banners={[mk("a", { display_seconds: 3 }), mk("b")]} />);
    const dot = () => screen.getByRole("button", { name: "Oznámení 1" }).getAttribute("aria-current");
    expect(dot()).toBe("true");
    act(() => { vi.advanceTimersByTime(2900); });
    expect(dot()).toBe("true");
    act(() => { vi.advanceTimersByTime(200); });
    expect(dot()).toBe("false");
    fireEvent.mouseEnter(screen.getByRole("region", { name: "Oznámení" }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(screen.getByRole("button", { name: "Oznámení 2" }).getAttribute("aria-current")).toBe("true");
    vi.useRealTimers();
  });
  it("při omezeném pohybu se samo nestřídá", () => {
    vi.useFakeTimers();
    const mm = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} });
    render(<BannerCarousel banners={[mk("a", { display_seconds: 3 }), mk("b")]} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("button", { name: "Oznámení 1" }).getAttribute("aria-current")).toBe("true");
    (window as any).matchMedia = mm;
    vi.useRealTimers();
  });
  it("při úspoře dat nevykreslí video, jen poster", () => {
    (navigator as any).connection = { saveData: true };
    const { container } = render(<BannerCarousel banners={[mk("v", { media_type: "video", image_path: null, video_path: "platform/v.mp4", poster_path: "platform/p.jpg" })]} />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img", { name: "Banner v" })).toBeInTheDocument();
    delete (navigator as any).connection;
  });
  it("video se po 2 smyčkách zastaví na posteru", () => {
    const { container } = render(<BannerCarousel banners={[mk("v", { media_type: "video", image_path: null, video_path: "platform/v.mp4", poster_path: "platform/p.jpg" })]} />);
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    fireEvent.ended(video);
    expect(container.querySelector("video")).not.toBeNull();
    fireEvent.ended(container.querySelector("video")!);
    expect(container.querySelector("video")).toBeNull();
  });
});

describe("validace nahrání", () => {
  it("typ a velikost 3 MB", () => {
    expect(validateBannerFile({ type: "image/gif", size: 1 }, "image")).toContain("JPG");
    expect(validateBannerFile({ type: "image/png", size: 3 * 1024 * 1024 + 1 }, "image")).toContain("3 MB");
    expect(validateBannerFile({ type: "video/webm", size: 1 }, "video")).toContain("MP4");
    expect(validateBannerFile({ type: "video/mp4", size: 1000 }, "video")).toBeNull();
  });
  it("rozměry 1500×500, 1584×396, 1920×480", () => {
    expect(validateBannerDimensions(1500, 500)).toBeNull();
    expect(validateBannerDimensions(1584, 396)).toBeNull();
    expect(validateBannerDimensions(1920, 480)).toBeNull();
    expect(validateBannerDimensions(1600, 900)).toContain("nesedí");
  });
  it("video nejvýš 10 s", () => {
    expect(validateVideoDuration(10)).toBeNull();
    expect(validateVideoDuration(11)).toContain("10 sekund");
  });
  it("formulář: alt, https, 3–60 s, od < do, skupina", () => {
    const ok = { alt_text: "Akce", link_url: "", display_seconds: 6, starts_at: "", ends_at: "", target_students: true, target_teachers: false, target_leadership: false };
    expect(validateBannerForm(ok)).toBeNull();
    expect(validateBannerForm({ ...ok, alt_text: "a" })).toContain("alt");
    expect(validateBannerForm({ ...ok, link_url: "http://x.cz" })).toContain("https");
    expect(validateBannerForm({ ...ok, display_seconds: 2 })).toContain("3–60");
    expect(validateBannerForm({ ...ok, display_seconds: 61 })).toContain("3–60");
    expect(validateBannerForm({ ...ok, starts_at: "2026-10-25T10:00", ends_at: "2026-10-24T10:00" })).toContain("Konec");
    expect(validateBannerForm({ ...ok, target_students: false })).toContain("skupinu");
  });
  it("při výměně smaže jen staré soubory", () => {
    expect(stalePaths(["a.jpg", null, null], ["b.jpg", null, null])).toEqual(["a.jpg"]);
    expect(stalePaths(["v.mp4", "p.jpg"], ["v.mp4", "p2.jpg"])).toEqual(["p.jpg"]);
  });
  it("hlášky triggeru a oprávnění česky", () => {
    expect(bannerErrorMessage({ message: "Škola může mít nejvýš 3 aktivní bannery" })).toBe("Škola může mít nejvýš 3 aktivní bannery");
    expect(bannerErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toBe("Tuto změnu nemáte oprávnění provést.");
  });
});

describe("náhled vybraného souboru", () => {
  it("blob URL zůstane beze změny a není odvolán před načtením", async () => {
    const { bannerPublicUrl } = await import("@/lib/banners");
    const blob = "blob:http://localhost/abc-123";
    expect(bannerPublicUrl(blob)).toBe(blob);
    expect(bannerPublicUrl("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
    expect(bannerPublicUrl("platform/x.png")).toContain("/storage/v1/object/public/banners/platform/x.png");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    render(<BannerCarousel banners={[mk("p", { image_path: blob, alt_text: "Náhled" })]} preview />);
    const img = screen.getByAltText("Náhled") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(blob);
    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});
