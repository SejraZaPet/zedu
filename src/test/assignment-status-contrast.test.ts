import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/index.css", "utf8");
const luminance = (rgb: number[]) => rgb.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
function hslRgb(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); });
}
describe("assignment card AA contrast", () => {
  it.each(["pending", "soon", "submitted", "overdue", "graded", "preparing"])("%s maintains white text contrast along the entire gradient", (state) => {
    const stops = ["from", "mid", "to"].map((stop) => {
      const match = css.match(new RegExp(`--assignment-${state}-${stop}: ([\\d.]+) ([\\d.]+)% ([\\d.]+)%`));
      if (!match) throw new Error("Missing semantic color token");
      return hslRgb(Number(match[1]), Number(match[2]), Number(match[3]));
    });
    const scrim = Number(css.match(/var\(--assignment-scrim\) \/ (\.[0-9]+)/)?.[1]);
    for (let segment = 0; segment < 2; segment++) {
      for (let step = 0; step <= 100; step++) {
        const rgb = stops[segment].map((v, i) => (v + (stops[segment + 1][i] - v) * step / 100) * (1 - scrim));
        expect(1.05 / (luminance(rgb) + .05)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(1.05 / (luminance(stops[0]) + .05)).toBeGreaterThanOrEqual(4.5);
  });
});