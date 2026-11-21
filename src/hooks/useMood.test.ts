import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOODS, moodForUser, normalizeMood, readStoredMood, storeMood } from "./useMood";

const storage = (mood: string | null, owner: string | null) => ({
  getItem: (key: string) => key.endsWith(":mood") ? mood : owner,
  setItem: () => {},
  removeItem: () => {},
});

describe("Nálady v prohlížeči", () => {
  it("akceptuje všech osm nálad v odsouhlaseném pořadí a neplatnou hodnotu vrátí na Bezli", () => {
    const moods = ["bezli", "minimal", "natural", "cute", "ocean", "plum", "sunny", "calm"] as const;
    expect(moods.map(normalizeMood)).toEqual(moods);
    for (const mood of moods) {
      expect(readStoredMood(storage(mood, "user-a"))).toEqual({ mood, ownerId: "user-a" });
    }
    expect(normalizeMood("unknown")).toBe("bezli");
    expect(normalizeMood(null)).toBe("bezli");
  });

  it("uloží a znovu načte každou z osmi voleb", () => {
    for (const mood of MOODS) {
      const values = new Map<string, string>();
      const memoryStorage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      };
      storeMood(mood, "user-a", memoryStorage);
      expect(readStoredMood(memoryStorage)).toEqual({ mood, ownerId: "user-a" });
    }
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
    expect(html).toContain('["minimal", "natural", "cute", "ocean", "plum", "sunny", "calm"].includes(saved)');
  });
});
