import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");

function luminance(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const linear = (value: number) => {
    const channel = value + m;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r1) + 0.7152 * linear(g1) + 0.0722 * linear(b1);
}

describe("Sdílené dlaždice – kontrast", () => {
  it("bílý text má aspoň 4,5:1 na obou koncích každého žákovského i učitelského přechodu", () => {
    for (const tone of ["learn", "subjects", "textbooks", "assignments", "notebook", "portfolio", "schedule", "studio", "review", "teaching", "preparation", "classes"]) {
      for (const stop of ["from", "to"]) {
        const match = css.match(new RegExp(`--dashboard-tile-${tone}-${stop}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
        expect(match, `${tone}-${stop}`).not.toBeNull();
        const ratio = 1.05 / (luminance(Number(match![1]), Number(match![2]), Number(match![3])) + 0.05);
        expect(ratio, `${tone}-${stop}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
