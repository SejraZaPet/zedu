import { cloneTemplateSlides } from "@/lib/presentation-templates";

export type CustomTemplateScope = "slide" | "deck";
export interface CustomPresentationTemplate {
  id: string;
  name: string;
  scope: CustomTemplateScope;
  slides: any[];
  createdAt: string;
}

const KEY_PREFIX = "bezli:presentation-templates:v1:";
const MAX_TEMPLATES = 20;
const MAX_JSON_CHARS = 1_000_000;
const key = (userId: string) => `${KEY_PREFIX}${userId}`;
const clone = (value: any) => structuredClone(value);

/** Lokální úložiště existující aplikace; žádný obsah se neposílá na server. */
export function loadCustomPresentationTemplates(userId: string, storage: Storage | undefined = globalThis.localStorage): CustomPresentationTemplate[] {
  if (!userId || !storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key(userId)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" &&
      (item.scope === "slide" || item.scope === "deck") && Array.isArray(item.slides) && item.slides.length > 0);
  } catch { return []; }
}

export function saveCustomPresentationTemplate(userId: string, name: string, scope: CustomTemplateScope, slides: any[], storage: Storage | undefined = globalThis.localStorage): CustomPresentationTemplate {
  const trimmed = name.trim();
  if (!userId) throw new Error("Šablonu může uložit pouze přihlášený učitel.");
  if (!trimmed) throw new Error("Pojmenujte šablonu.");
  if (!storage) throw new Error("Úložiště prohlížeče není dostupné.");
  if (!Array.isArray(slides) || !slides.length) throw new Error("Šablona musí obsahovat alespoň jeden slide.");
  if (scope === "slide" && slides.length !== 1) throw new Error("Šablona slidu musí obsahovat právě jeden slide.");
  const current = loadCustomPresentationTemplates(userId, storage);
  if (current.length >= MAX_TEMPLATES) throw new Error("Můžete mít nejvýše 20 vlastních šablon. Nejprve některou odeberte.");
  const item: CustomPresentationTemplate = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `custom-${Date.now()}`,
    name: trimmed.slice(0, 80), scope, slides: clone(slides), createdAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify([item, ...current]);
  if (serialized.length > MAX_JSON_CHARS) throw new Error("Šablona je příliš velká pro toto úložiště. Uložte kratší prezentaci nebo použijte adresy obrázků místo vložených dat.");
  storage.setItem(key(userId), serialized);
  return item;
}

export function deleteCustomPresentationTemplate(userId: string, id: string, storage: Storage | undefined = globalThis.localStorage): CustomPresentationTemplate[] {
  if (!storage) return [];
  const next = loadCustomPresentationTemplates(userId, storage).filter((item) => item.id !== id);
  storage.setItem(key(userId), JSON.stringify(next));
  return next;
}

export function customTemplateSlides(template: CustomPresentationTemplate): any[] {
  return cloneTemplateSlides(template.slides);
}
