/**
 * Kontrast snímku prezentace.
 *
 * Snímky vygenerované z lekce přebírají barvu pozadí bloku (pastelové světlé
 * odstíny). Motiv prezentace je ale často tmavý, takže text zůstával světlý na
 * světlém pozadí. Tady se z reálného pozadí snímku určí, jestli má být text
 * světlý nebo tmavý.
 */

/** Světlost 0–1 z CSS barvy (hex, `hsl()`, `rgb()`), jinak `null`. */
export function cssColorLightness(input?: string | null): number | null {
  const value = String(input || "").trim();
  if (!value || value === "transparent") return null;

  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const hsl = /^hsla?\(\s*([-\d.]+)[deg\s]*[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i.exec(value);
  if (hsl) return Number(hsl[3]) / 100;

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (rgb) {
    const [r, g, b] = [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  return null;
}

/** Barvy v gradientu (`linear-gradient(...)`) → seznam CSS barev. */
function gradientColors(css: string): string[] {
  return (css.match(/#[0-9a-f]{3,6}|hsla?\([^)]*\)|rgba?\([^)]*\)/gi) || []);
}

/**
 * Je pozadí snímku světlé? `null` = snímek vlastní pozadí nemá, rozhoduje motiv.
 */
export function slideBackgroundIsLight(slide: any): boolean | null {
  const override = slide?.backgroundOverride;
  if (!override) return null;
  // Obrázek na pozadí – nelze spolehlivě změřit, necháváme na motivu.
  if (typeof override.image === "string" && override.image) return null;

  const gradient = override.gradient;
  if (gradient) {
    const colors = [gradient.from, gradient.to, gradient.via]
      .filter((c: unknown): c is string => typeof c === "string" && !!c);
    const source = colors.length ? colors : gradientColors(String(gradient.css || ""));
    const values = source.map(cssColorLightness).filter((n): n is number => n !== null);
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length > 0.6;
  }

  const lightness = cssColorLightness(override.color);
  if (lightness === null) return null;
  return lightness > 0.6;
}

/**
 * Výsledný režim textu snímku: vlastní světlé pozadí vždy přebije tmavý motiv
 * (a naopak), jinak rozhoduje motiv / `darkMode`.
 */
export function resolveSlideIsDark(
  slide: any,
  themeIsDark: boolean,
): boolean {
  const light = slideBackgroundIsLight(slide);
  if (light === null) return themeIsDark;
  return !light;
}

/** Čitelný nadpis: barvy motivu se použijí jen tam, kde mají kontrast. */
export function headlineColorsForBackground(
  primary: string,
  secondary: string,
  isDark: boolean,
): { primary: string; secondary: string } {
  const values = [primary, secondary].map(cssColorLightness);
  const avg = values.filter((n): n is number => n !== null);
  const light = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : isDark ? 1 : 0;

  // Na světlém pozadí potřebujeme tmavý nadpis a naopak.
  if (!isDark && light > 0.55) return { primary: "#0F172A", secondary: "#334155" };
  if (isDark && light < 0.45) return { primary: "#FFFFFF", secondary: "#E2E8F0" };
  return { primary, secondary };
}
