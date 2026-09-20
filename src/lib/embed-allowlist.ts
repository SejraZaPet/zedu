/**
 * Allowlist domén pro blok "embed" (externí interaktivní obsah).
 * Vkládat lze jen obsah z těchto služeb – cokoli jiného se nevykreslí.
 */
export const EMBED_ALLOWED_HOSTS: string[] = [
  "phet.colorado.edu",
  "www.geogebra.org",
  "geogebra.org",
  "www.desmos.com",
  "desmos.com",
  "h5p.org",
  "*.h5p.com",
  "www.canva.com",
  "padlet.com",
  "*.padlet.com",
  "miro.com",
  "*.miro.com",
  "scratch.mit.edu",
  "www.mentimeter.com",
  "docs.google.com",
];

export const EMBED_ALLOWED_LABEL =
  "PhET, GeoGebra, Desmos, H5P, Canva, Padlet, Miro, Scratch, Mentimeter, Google Dokumenty";

const hostMatches = (host: string, pattern: string): boolean => {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) {
    const base = p.slice(2);
    return h === base || h.endsWith(`.${base}`);
  }
  return h === p;
};

/** Vrátí true, jen když je URL https a doména je na allowlistu. */
export const isAllowedEmbedUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return EMBED_ALLOWED_HOSTS.some((pattern) => hostMatches(parsed.hostname, pattern));
};

/** Poměr stran pro CSS (výchozí 16:9). */
export const embedAspectRatio = (value: string | null | undefined): string => {
  const raw = (value || "16:9").toString().trim();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return "16 / 9";
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return "16 / 9";
  return `${w} / ${h}`;
};

export const EMBED_ASPECT_OPTIONS = ["16:9", "4:3", "1:1", "3:4"];
