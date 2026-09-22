/**
 * Sdílené pomůcky pro míchání pořadí u aktivit (přiřazování, řazení, volby).
 *
 * `shuffleNonIdentity` zaručí, že výsledné pořadí není identické se vstupem
 * (pokud existuje alespoň jedna jiná permutace) — u přiřazování by shodné
 * pořadí prozradilo správné páry.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates shuffle (nemutuje vstup). */
export function shuffleArray<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Zamíchá pole tak, aby výsledek nebyl ve stejném pořadí jako vstup.
 * Když jsou všechny prvky shodné (nebo je pole kratší než 2), vrací kopii.
 */
export function shuffleNonIdentity<T>(
  arr: readonly T[],
  rng: () => number = Math.random,
): T[] {
  if (arr.length < 2) return [...arr];
  const distinct = new Set(arr.map((v) => JSON.stringify(v)));
  if (distinct.size < 2) return [...arr];

  const same = (candidate: T[]) => candidate.every((v, i) => v === arr[i]);

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = shuffleArray(arr, rng);
    if (!same(candidate)) return candidate;
  }
  // Fallback: deterministická rotace o 1 — nikdy není identita
  return [...arr.slice(1), arr[0]];
}

/** Zamíchání s pevným semínkem (stabilní mezi rendery, např. pro tisk). */
export function seededShuffleNonIdentity<T>(arr: readonly T[], seed: string | number): T[] {
  const s = typeof seed === "number" ? seed : hashString(seed);
  return shuffleNonIdentity(arr, mulberry32(s));
}
