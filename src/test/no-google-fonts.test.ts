import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe("self-hosted fonts", () => {
  it("no requests to Google Fonts in index.html, src/ or public/", () => {
    const files = ["index.html", ...walk("src"), ...walk("public")].filter(
      (f) => /\.(html|css|tsx?|jsx?|json|webmanifest)$/.test(f) && !f.endsWith("no-google-fonts.test.ts"),
    );
    const hits = files.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("Lexend, Lato and Baloo 2 are imported locally", () => {
    const css = readFileSync("src/index.css", "utf8");
    for (const f of ["lexend/400", "lexend/700", "lato/400", "lato/900", "baloo-2/500", "baloo-2/700"])
      expect(css).toContain(`@fontsource/${f}.css`);
  });
});
