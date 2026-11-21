import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bundleState, checkAddBatch, kindForFile, moveSource, SOURCE_KIND_LABEL, SOURCE_LIMITS,
  type SourceAudience, type SourceItem, type SourceKind,
} from "@/lib/source-bundle";
// Extrakce (PDF/Word čtečky) se načítá až při prvním zdroji – nezatěžuje otevření dialogů.
const extractor = () => import("@/lib/source-extract");

type Loaded = { text: string; origin?: string; note?: string };
type Loader = () => Promise<{ text: string; origin?: string; note?: string }>;

/**
 * Stav balíku zdrojů: přidání nic nenahradí, zpracování jde postupně (jedno po druhém),
 * chyba jedné položky nezahodí ostatní, zrušené položky se nepřepíšou pozdním výsledkem.
 */
export function useSourceBundle(audience: SourceAudience = "teacher", onReject?: (msg: string) => void) {
  const [items, setItems] = useState<SourceItem[]>([]);
  const loaders = useRef(new Map<string, Loader>());
  const fileOf = useRef(new Map<string, File>());
  const previews = useRef(new Set<string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; previews.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const patch = (id: string, p: Partial<SourceItem>) =>
    alive.current && setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

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
    setItems((prev) => at === undefined ? [...prev, ...rows] : [...prev.slice(0, at), ...rows, ...prev.slice(at)]);
    created.forEach((c) => { loaders.current.set(c.id, c.load); void run(c.id); });
  };

  const addFiles = (files: File[]) => {
    const list = Array.from(files); // snapshot před vyprázdněním inputu
    const incoming = list.map((f) => ({ kind: kindForFile(f), size: f.size, name: f.name }));
    const err = checkAddBatch(items, incoming);
    if (err) { onReject?.(err); return false; }
    push(list.map((f, i) => {
      const kind = incoming[i].kind!;
      return { kind, file: f, label: f.name || SOURCE_KIND_LABEL[kind], origin: f.name, load: async (): Promise<Loaded> => ({ text: await (await extractor()).extractFileSource(f, kind) }) };
    }));
    return true;
  };

  const addText = (text: string) => {
    const t = text.trim();
    if (!t) return false;
    const err = checkAddBatch(items, [{ kind: "text" }]);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "text", label: t.slice(0, 40) + (t.length > 40 ? "…" : ""), load: async () => ({ text: t }) }]);
    return true;
  };

  const addUrl = (url: string) => {
    const err = checkAddBatch(items, [{ kind: "url" }]);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "url", label: url.trim(), load: async () => (await extractor()).extractUrlSource(url.trim()) }]);
    return true;
  };

  const addLesson = (title: string, getText: () => Promise<string> | string) => {
    const err = checkAddBatch(items, [{ kind: "lesson" }]);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "lesson", label: title, origin: title, load: async () => ({ text: (await getText()).trim() }) }]);
    return true;
  };

  const dropPreview = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (it?.preview) { URL.revokeObjectURL(it.preview); previews.current.delete(it.preview); }
    fileOf.current.delete(id);
  };
  const remove = (id: string) => { dropPreview(id); loaders.current.delete(id); setItems((p) => p.filter((i) => i.id !== id)); };

  /** Skenované PDF → stránky jako fotky (OCR). Nevejde-li se, nic nemění a vysvětlí proč. */
  const convertPdfToPhotos = async (id: string) => {
    const file = fileOf.current.get(id);
    if (!file) return false;
    const freePhotos = SOURCE_LIMITS.maxPhotos - items.filter((i) => i.kind === "photo").length;
    if (freePhotos <= 0) { onReject?.(`Už máte ${SOURCE_LIMITS.maxPhotos} fotek. Odeberte některé, nebo text vložte ručně.`); return false; }
    patch(id, { status: "loading", error: "Převádím stránky na obrázky…", scanned: undefined });
    try {
      const { files: pages, total } = await (await extractor()).pdfPagesAsPhotos(file, freePhotos);
      if (!pages.length) throw new Error("PDF nemá žádné stránky.");
      const at = items.findIndex((i) => i.id === id);
      loaders.current.delete(id); fileOf.current.delete(id);
      setItems((p) => p.filter((i) => i.id !== id));
      push(pages.map((f) => ({ kind: "photo" as const, file: f, label: f.name, origin: f.name,
        load: async (): Promise<Loaded> => ({ text: await (await extractor()).extractFileSource(f, "photo") }) })), at < 0 ? undefined : at);
      if (total > pages.length) onReject?.(`PDF má ${total} stran, zpracováno prvních ${pages.length} (limit ${SOURCE_LIMITS.maxPhotos} fotek). Zbytek vložte jako text nebo rozdělte do dalšího generování.`);
      return true;
    } catch {
      patch(id, { status: "error", scanned: true, error: "Stránky PDF se nepodařilo převést na obrázky. Vyfoťte je, nebo text vložte ručně." });
      return false;
    }
  };
  const move = (id: string, delta: number) => setItems((p) => moveSource(p, id, delta));
  const retry = (id: string) => void run(id);
  const updateText = (id: string, text: string) => patch(id, { text, error: undefined });
  const clear = () => { loaders.current.clear(); fileOf.current.clear(); previews.current.forEach((u) => URL.revokeObjectURL(u)); previews.current.clear(); setItems([]); };

  const state = useMemo(() => bundleState(items, audience), [items, audience]);
  return { items, state, audience, addFiles, addText, addUrl, addLesson, remove, convertPdfToPhotos, move, retry, updateText, clear };
}

export type SourceBundle = ReturnType<typeof useSourceBundle>;
