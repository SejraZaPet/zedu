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

const RESERVED = new Set(["www", "app", "id-preview", "preview", "zedu", "lovable", "staging"]);

export function detectSubdomain(hostname: string = window.location.hostname): string | null {
  if (!hostname || hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
  const parts = hostname.split(".");
  // need at least sub.domain.tld
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  if (RESERVED.has(sub)) return null;
  // Lovable preview hosts often start with id-preview-- — skip
  if (sub.includes("--") || sub.startsWith("id-preview")) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(sub)) return null;
  return sub;
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

let cached: SchoolBranding | null | undefined = undefined;

export function useSchoolBranding() {
  const [branding, setBranding] = useState<SchoolBranding | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (cached !== undefined) {
      setBranding(cached);
      setLoading(false);
      return;
    }
    const sub = detectSubdomain();
    if (!sub) {
      cached = null;
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("schools")
        .select("id, name, subdomain, custom_logo_url, custom_primary_color, custom_welcome_text")
        .eq("subdomain", sub)
        .maybeSingle();
      if (!active) return;
      cached = (data as SchoolBranding) ?? null;
      setBranding(cached);
      setLoading(false);
      if (cached?.custom_primary_color) {
        const hsl = hexToHslString(cached.custom_primary_color);
        if (hsl) {
          document.documentElement.style.setProperty("--primary", hsl);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  return { branding, loading };
}
