/** Čisté hledání v názvech (lekcí, učebnic) bez ohledu na diakritiku a velikost písmen. */
export const foldText = (s: string): string =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function filterByTitle<T extends { title: string }>(items: T[], query: string): T[] {
  const q = foldText(query);
  if (!q) return items;
  return items.filter((i) => foldText(i.title || "").includes(q));
}

/** Přepne výběr; ostatní vybrané položky zůstávají (i když jsou skryté filtrem). */
export function togglePicked(picked: string[], id: string, on: boolean): string[] {
  if (on) return picked.includes(id) ? picked : [...picked, id];
  return picked.filter((x) => x !== id);
}
