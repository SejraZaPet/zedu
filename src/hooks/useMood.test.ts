import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { moodForUser, normalizeMood, readStoredMood } from "./useMood";

const storage = (mood: string | null, owner: string | null) => ({
  getItem: (key: string) => key.endsWith(":mood") ? mood : owner,
  setItem: () => {},
  removeItem: () => {},
});

describe("Nálady v prohlížeči", () => {
  it("akceptuje jen Bezli, Minimal a Natural", () => {
    expect(normalizeMood("minimal")).toBe("minimal");
    expect(normalizeMood("natural")).toBe("natural");
    expect(normalizeMood("ocean")).toBe("bezli");
    expect(normalizeMood(null)).toBe("bezli");
  });

  it("stejnému uživateli po obnovení stránky ponechá náladu", () => {
    const stored = readStoredMood(storage("natural", "user-a"));
    expect(moodForUser(stored.mood, stored.ownerId, "user-a")).toBe("natural");
  });

  it("jiného uživatele i odhlášení vrátí na Bezli", () => {
    const stored = readStoredMood(storage("minimal", "user-a"));
    expect(moodForUser(stored.mood, stored.ownerId, "user-b")).toBe("bezli");
    expect(moodForUser(stored.mood, stored.ownerId, null)).toBe("bezli");
    expect(moodForUser(stored.mood, null, "user-a")).toBe("bezli");
  });

  it("nedostupné úložiště bezpečně použije Bezli", () => {
    expect(readStoredMood({
      getItem: () => { throw new Error("blocked"); },
      setItem: () => {},
      removeItem: () => {},
    })).toEqual({ mood: "bezli", ownerId: null });
  });

  it("index.html nastaví náladu synchronně ještě před modulem aplikace", () => {
    const html = readFileSync("index.html", "utf8");
    const apply = html.indexOf('document.documentElement.dataset.mood = mood');
    const module = html.indexOf('<script type="module"');
    expect(apply).toBeGreaterThan(-1);
    expect(module).toBeGreaterThan(apply);
    expect(html).toContain('localStorage.getItem("Bezli:mood")');
    expect(html).toContain('saved === "minimal" || saved === "natural"');
  });
});
