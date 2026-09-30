import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "span"];
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const isAssignmentDescriptionHtml = (value: string) => /<[a-z][\s\S]*>/i.test(value);

/** Staré prosté texty převede na odstavce, aby si v editoru zachovaly zalomení. */
export const assignmentDescriptionToEditorHtml = (value: string) => {
  if (!value || isAssignmentDescriptionHtml(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
};

/**
 * Povolí jen formátování dostupné v editoru zadání. U stylů zachová výhradně
 * bezpečnou barvu textu; ostatní inline styly odstraní.
 */
export const sanitizeAssignmentDescription = (value: string) => {
  const source = assignmentDescriptionToEditorHtml(value);
  const clean = DOMPurify.sanitize(source, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["style"],
  });

  const container = document.createElement("div");
  container.innerHTML = clean;
  container.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const color = element.style.color.trim();
    element.removeAttribute("style");
    if (SAFE_COLOR.test(color)) element.style.color = color;
  });
  return container.innerHTML;
};

/** Čistý text pro hlasové čtení, náhledy a AI kontext. */
export const assignmentDescriptionToText = (value: string) => {
  const clean = sanitizeAssignmentDescription(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");
  const container = document.createElement("div");
  container.innerHTML = clean;
  return (container.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
};