import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/index.css", "utf8");
const luminance = (rgb: number[]) => rgb.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
function hslRgb(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); });
}
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
};
const token = (state: string, name: string) => {
  const match = css.match(new RegExp(`--assignment-${state}-${name}: ([\\d.]+) ([\\d.]+)% ([\\d.]+)%`));
  if (!match) throw new Error(`Missing semantic color token --assignment-${state}-${name}`);
  return hslRgb(Number(match[1]), Number(match[2]), Number(match[3]));
};
/** Gradient runs 100deg left→right; the mid stop sits at 55%. */
function gradientAt(state: string, pct: number) {
  const from = token(state, "from"), mid = token(state, "mid"), to = token(state, "to");
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  return pct <= 55 ? mix(from, mid, pct / 55) : mix(mid, to, (pct - 55) / 45);
}
const WHITE = [1, 1, 1];

describe("assignment card readability", () => {
  it.each(["pending", "soon", "submitted", "overdue", "graded", "preparing"])("%s badge keeps dark text on white at AA", (state) => {
    expect(contrast(token(state, "badge"), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it("light amber 'soon' card uses dark text with AA contrast along the entire gradient", () => {
    for (let step = 0; step <= 100; step += 5) {
      expect(contrast(gradientAt("soon", step), token("soon", "foreground"))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(["pending", "submitted", "overdue", "graded", "preparing"])("%s keeps white title text readable over the gradient", (state) => {
    expect(contrast(token(state, "from"), WHITE)).toBeGreaterThanOrEqual(4.5);
    for (let step = 5; step <= 20; step += 5) {
      expect(contrast(gradientAt(state, step), WHITE)).toBeGreaterThanOrEqual(3);
    }
  });
});
