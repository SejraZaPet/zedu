import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");
const MOODS = ["bezli", "minimal", "natural"] as const;
const TILE_TONES = [
  "learn", "subjects", "textbooks", "assignments", "notebook", "portfolio",
  "schedule", "studio", "review", "teaching", "preparation", "classes",
] as const;

function moodCss(mood: (typeof MOODS)[number]): string {
  // Bezli používá :root a pozdější sdílené tokeny učení; vždy první deklaraci tokenu.
  if (mood === "bezli") return css;
  const match = css.match(new RegExp(`html\\[data-mood="${mood}"\\]\\s*\\{([\\s\\S]*?)\\n  \\}`));
  expect(match, mood).not.toBeNull();
  return match![1];
}

function hsl(block: string, token: string): [number, number, number] {
  const match = block.match(new RegExp(`--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  expect(match, token).not.toBeNull();
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

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

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const first = luminance(...a);
  const second = luminance(...b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("Sdílené dlaždice – kontrast ve všech náladách", () => {
  it("nové nálady drží bílý text aspoň 4,6:1 a zachované Bezli původních 4,5:1", () => {
    for (const mood of MOODS) {
      const block = moodCss(mood);
      const tokens = TILE_TONES.flatMap((tone) => [
        `dashboard-tile-${tone}-from`, `dashboard-tile-${tone}-to`,
      ]);
      tokens.push("dashboard-today-current-from", "dashboard-today-current-to", "learning-exam-from", "learning-exam-to");
      for (const token of tokens) {
        // Bezli je chráněný dnešní základ (původní test 4,5:1); nové nálady mají přísnější 4,6:1.
        const minimum = mood === "bezli" ? 4.5 : 4.6;
        expect(ratio([0, 0, 100], hsl(block, token)), `${mood}: ${token}`).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("nové nálady drží texty aspoň 4,5:1 a Bezli zachovává dnešní základ", () => {
    for (const mood of MOODS) {
      const block = moodCss(mood);
      for (const [text, background] of [
        ["foreground", "background"],
        ["card-foreground", "card"],
        ["muted-foreground", "muted"],
      ]) {
        // Dnešní Bezli muted text (4,25:1) se v etapě 0 nesmí změnit; nové palety splňují AA.
        if (mood === "bezli" && text === "muted-foreground") {
          expect(hsl(block, text)).toEqual([220, 13, 46]);
          continue;
        }
        expect(ratio(hsl(block, text), hsl(block, background)), `${mood}: ${text}/${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("Minimal a Natural nepřepisují stavové ani herní barvy", () => {
    const root = moodCss("bezli");
    const stateTokens = [
      "activity-correct", "destructive", "destructive-foreground", "warning", "warning-foreground",
      "answer-red", "answer-blue", "answer-yellow", "answer-green", "answer-purple",
      "answer-orange", "answer-teal", "answer-pink",
    ];
    for (const token of stateTokens) expect(hsl(root, token)).toBeDefined();
    for (const mood of ["minimal", "natural"] as const) {
      const block = moodCss(mood);
      for (const token of stateTokens) {
        expect(new RegExp(`--${token}\\s*:`).test(block), `${mood} nesmí přepsat --${token}`).toBe(false);
      }
    }
  });

  it("nemění sdílené brand tokeny používané herními motivy", () => {
    for (const mood of ["minimal", "natural"] as const) {
      const block = moodCss(mood);
      for (const token of ["brand-purple", "brand-lavender", "brand-periwinkle", "brand-blue", "brand-turquoise"]) {
        expect(new RegExp(`--${token}\\s*:`).test(block), `${mood} nesmí přepsat --${token}`).toBe(false);
      }
    }
  });

  it("Natural primární je tmavá šalvěj výrazně odlišná od barvy úspěchu", () => {
    const primary = hsl(moodCss("natural"), "primary");
    const success = hsl(moodCss("bezli"), "activity-correct");
    expect(Math.abs(primary[0] - success[0])).toBeGreaterThanOrEqual(20);
    expect(luminance(...primary)).toBeLessThan(luminance(...success));
  });
});
