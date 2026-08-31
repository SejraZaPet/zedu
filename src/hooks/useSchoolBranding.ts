import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SchoolBranding {
  id: string;
  name: string;
  subdomain: string;
  custom_logo_url: string | null;
  custom_primary_color: string | null;
  custom_welcome_text: string | null;
  registration_code: string | null;
}

const RESERVED = new Set(["www", "app", "id-preview", "preview", "bezli", "lovable", "staging"]);

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;
const STORAGE_KEY = "bezli-school-slug";

export function detectSubdomain(hostname: string = window.location.hostname): string | null {
  if (!hostname || hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
  const parts = hostname.split(".");
  // need at least sub.domain.tld
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  if (RESERVED.has(sub)) return null;
  // Lovable preview hosts often start with id-preview-- — skip
  if (sub.includes("--") || sub.startsWith("id-preview")) return null;
  if (!SLUG_RE.test(sub)) return null;
  return sub;
}

/** Slug z cesty /s/:slug (funguje na jakékoli doméně). */
export function detectPathSlug(pathname: string = window.location.pathname): string | null {
  const m = pathname.match(/^\/s\/([^/?#]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

/** Uloží slug školy pro zbytek session (přežije navigaci mimo /s/:slug). */
export function rememberSchoolSlug(slug: string) {
  try {
    if (SLUG_RE.test(slug)) sessionStorage.setItem(STORAGE_KEY, slug);
  } catch {
    /* ignore */
  }
}

function storedSchoolSlug(): string | null {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    return s && SLUG_RE.test(s) ? s : null;
  } catch {
    return null;
  }
}

/** Priorita: subdoména → cesta /s/:slug → zapamatovaný slug ze session. */
export function detectSchoolSlug(): string | null {
  return detectSubdomain() ?? detectPathSlug() ?? storedSchoolSlug();
}


// Convert "#rrggbb" to "h s% l%" string usable in CSS HSL var
function hexToHslString(hex: string): string | null {
  const m = hex.trim().replace("#", "");
  if (!/^([0-9a-f]{6})$/i.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const cache = new Map<string, SchoolBranding | null>();

export function useSchoolBranding() {
  const slug = detectSchoolSlug();
  const initial = slug ? cache.get(slug) : null;
  const [branding, setBranding] = useState<SchoolBranding | null>(initial ?? null);
  const [loading, setLoading] = useState(!!slug && initial === undefined);

  useEffect(() => {
    if (!slug) {
      setBranding(null);
      setLoading(false);
      return;
    }
    const applyTint = (b: SchoolBranding | null) => {
      if (b?.custom_primary_color) {
        const hsl = hexToHslString(b.custom_primary_color);
        if (hsl) document.documentElement.style.setProperty("--primary", hsl);
      }
    };
    if (cache.has(slug)) {
      const hit = cache.get(slug) ?? null;
      setBranding(hit);
      setLoading(false);
      applyTint(hit);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("schools_public" as any)
        .select("id, name, subdomain, custom_logo_url, custom_primary_color, custom_welcome_text, registration_code")
        .eq("subdomain", slug)
        .maybeSingle();
      const result = (data as unknown as SchoolBranding) ?? null;
      cache.set(slug, result);
      if (!active) return;
      setBranding(result);
      setLoading(false);
      applyTint(result);
    })();
    return () => { active = false; };
  }, [slug]);


  return { branding, loading };
}
