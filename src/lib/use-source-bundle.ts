import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bundleState, checkAddBatch, kindForFile, moveSource, SOURCE_KIND_LABEL, SOURCE_LIMITS,
  type SourceAudience, type SourceItem, type SourceKind, type SourceLimitOverrides,
} from "@/lib/source-bundle";
// Extrakce (PDF/Word čtečky) se načítá až při prvním zdroji – nezatěžuje otevření dialogů.
const extractor = () => import("@/lib/source-extract");

type Loaded = { text: string; origin?: string; note?: string };
type Loader = () => Promise<{ text: string; origin?: string; note?: string }>;

/**
 * Stav balíku zdrojů: přidání nic nenahradí, zpracování jde postupně (jedno po druhém),
 * chyba jedné položky nezahodí ostatní, zrušené položky se nepřepíšou pozdním výsledkem.
 */
export function useSourceBundle(audience: SourceAudience = "teacher", onReject?: (msg: string) => void, overrides: SourceLimitOverrides = {}) {
  const limits = { ...SOURCE_LIMITS, ...overrides };
  const [items, setItems] = useState<SourceItem[]>([]);
  const loaders = useRef(new Map<string, Loader>());
  const fileOf = useRef(new Map<string, File>());
  const previews = useRef(new Set<string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  const current = useRef<SourceItem[]>([]);
  const setCurrentItems = (update: (prev: SourceItem[]) => SourceItem[]) => {
    current.current = update(current.current);
    setItems(current.current);
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; loaders.current.clear(); previews.current.forEach((u) => URL.revokeObjectURL(u)); }; }, []);

  const patch = (id: string, p: Partial<SourceItem>) =>
    alive.current && setCurrentItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const run = useCallback((id: string) => {
    queue.current = queue.current.then(async () => {
      const load = loaders.current.get(id);
      if (!load) return; // mezitím odebráno
      patch(id, { status: "loading", error: undefined, scanned: undefined });
      try {
        const r = await load();
        if (!loaders.current.has(id)) return;
        patch(id, { status: "ready", text: r.text, origin: r.origin ?? undefined, error: r.note });
      } catch (e) {
        if (!loaders.current.has(id)) return;
        patch(id, {
          status: "error", error: e instanceof Error ? e.message : "Zdroj se nepodařilo načíst.",
          scanned: e instanceof Error && e.name === "ScannedPdfError" ? true : undefined,
        });
      }
    });
    return queue.current;
  }, []);

  const push = (entries: { kind: SourceKind; label: string; origin?: string; load: Loader; file?: File }[], at?: number) => {
    const created = entries.map((e) => {
      let preview: string | undefined;
      if (e.kind === "photo" && e.file && typeof URL.createObjectURL === "function") {
        try { preview = URL.createObjectURL(e.file); previews.current.add(preview); } catch { /* bez náhledu */ }
      }
      return { id: crypto.randomUUID(), ...e, preview };
    });
    created.forEach((c) => { if (c.file) fileOf.current.set(c.id, c.file); });
    const rows = created.map(({ id, kind, label, origin, preview }) => ({ id, kind, label, origin, preview, status: "loading" as const }));
    setCurrentItems((prev) => at === undefined ? [...prev, ...rows] : [...prev.slice(0, at), ...rows, ...prev.slice(at)]);
    created.forEach((c) => { loaders.current.set(c.id, c.load); void run(c.id); });
  };

  const addFiles = (files: File[]) => {
    const list = Array.from(files); // snapshot před vyprázdněním inputu
    const incoming = list.map((f) => ({ kind: kindForFile(f), size: f.size, name: f.name, type: f.type }));
    const err = checkAddBatch(current.current, incoming, overrides);
    if (err) { onReject?.(err); return false; }
    push(list.map((f, i) => {
      const kind = incoming[i].kind;
      if (!kind) throw new Error("Nepodporovaný zdroj.");
      return { kind, file: f, label: f.name || SOURCE_KIND_LABEL[kind], origin: f.name, load: async (): Promise<Loaded> => ({ text: await (await extractor()).extractFileSource(f, kind) }) };
    }));
    return true;
  };

  const addText = (text: string) => {
    const t = text.trim();
    if (!t) return false;
    const err = checkAddBatch(current.current, [{ kind: "text" }], overrides);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "text", label: t.slice(0, 40) + (t.length > 40 ? "…" : ""), load: async () => ({ text: t }) }]);
    return true;
  };

  const addUrl = (url: string) => {
    const err = checkAddBatch(current.current, [{ kind: "url" }], overrides);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "url", label: url.trim(), load: async () => (await extractor()).extractUrlSource(url.trim()) }]);
    return true;
  };

  const addLesson = (title: string, getText: () => Promise<string> | string) => {
    const err = checkAddBatch(current.current, [{ kind: "lesson" }], overrides);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "lesson", label: title, origin: title, load: async () => ({ text: (await getText()).trim() }) }]);
    return true;
  };

  const dropPreview = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (it?.preview) { URL.revokeObjectURL(it.preview); previews.current.delete(it.preview); }
    fileOf.current.delete(id);
  };
  const remove = (id: string) => { dropPreview(id); loaders.current.delete(id); setCurrentItems((p) => p.filter((i) => i.id !== id)); };

  /** Skenované PDF → stránky jako fotky (OCR). Nevejde-li se, nic nemění a vysvětlí proč. */
  const convertPdfToPhotos = async (id: string) => {
    const file = fileOf.current.get(id);
    if (!file) return false;
    const freePhotos = limits.maxPhotos - current.current.filter((i) => i.kind === "photo").length;
    if (freePhotos <= 0) { onReject?.(`Už máte ${SOURCE_LIMITS.maxPhotos} fotek. Odeberte některé, nebo text vložte ručně.`); return false; }
    patch(id, { status: "loading", error: "Převádím stránky na obrázky…", scanned: undefined });
    try {
      const { files: pages, total } = await (await extractor()).pdfPagesAsPhotos(file, freePhotos);
      if (!pages.length) throw new Error("PDF nemá žádné stránky.");
      const at = items.findIndex((i) => i.id === id);
      loaders.current.delete(id); fileOf.current.delete(id);
      setCurrentItems((p) => p.filter((i) => i.id !== id));
      push(pages.map((f) => ({ kind: "photo" as const, file: f, label: f.name, origin: f.name,
        load: async (): Promise<Loaded> => ({ text: await (await extractor()).extractFileSource(f, "photo") }) })), at < 0 ? undefined : at);
      if (total > pages.length) onReject?.(`PDF má ${total} stran, zpracováno prvních ${pages.length} (limit ${SOURCE_LIMITS.maxPhotos} fotek). Zbytek vložte jako text nebo rozdělte do dalšího generování.`);
      return true;
    } catch {
      patch(id, { status: "error", scanned: true, error: "Stránky PDF se nepodařilo převést na obrázky. Vyfoťte je, nebo text vložte ručně." });
      return false;
    }
  };
  const move = (id: string, delta: number) => setCurrentItems((p) => moveSource(p, id, delta));
  const retry = (id: string) => void run(id);
  const updateText = (id: string, text: string) => patch(id, { text, error: undefined });
  const clear = () => { loaders.current.clear(); fileOf.current.clear(); previews.current.forEach((u) => URL.revokeObjectURL(u)); previews.current.clear(); setCurrentItems(() => []); };

  const state = bundleState(items, audience, overrides);
  return { items, state, audience, limits, addFiles, addText, addUrl, addLesson, remove, convertPdfToPhotos, move, retry, updateText, clear };
}

export type SourceBundle = ReturnType<typeof useSourceBundle>;
