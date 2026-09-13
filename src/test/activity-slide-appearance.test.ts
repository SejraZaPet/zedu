import { describe, expect, it } from "vitest";
import {
  activitySlideAppearanceStyle,
  getActivitySlideAppearance,
  hexToHslTriplet,
} from "@/lib/activity-slide-appearance";

describe("vzhled aktivity na snímku", () => {
  it("doplní výchozí hodnoty", () => {
    const a = getActivitySlideAppearance(undefined);
    expect(a).toMatchObject({ look: "light", fontScale: 1, expanded: true, showHeader: true });
  });

  it("omezí měřítko textu", () => {
    expect(getActivitySlideAppearance({ fontScale: 5 }).fontScale).toBe(1.6);
    expect(getActivitySlideAppearance({ fontScale: 0.1 }).fontScale).toBe(0.6);
  });

  it("převede hex na HSL trojici", () => {
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("nope")).toBeNull();
  });

  it("tmavý vzhled přepíše tokeny na světlý text", () => {
    const style = activitySlideAppearanceStyle(getActivitySlideAppearance({ look: "dark" }));
    expect(style["--foreground"]).toBe("0 0% 100%");
    expect(style.fontSize).toBe("1em");
  });

  it("vlastní barvy se propíšou do tokenů", () => {
    const style = activitySlideAppearanceStyle(
      getActivitySlideAppearance({ look: "custom", cardColor: "#000000", textColor: "#ffffff" }),
    );
    expect(style["--card"]).toBe("0 0% 0%");
    expect(style["--foreground"]).toBe("0 0% 100%");
  });
});
