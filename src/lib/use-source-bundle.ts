import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bundleState, checkAddBatch, kindForFile, moveSource, SOURCE_KIND_LABEL,
  type SourceAudience, type SourceItem, type SourceKind,
} from "@/lib/source-bundle";
import { extractFileSource, extractUrlSource } from "@/lib/source-extract";

type Loader = () => Promise<{ text: string; origin?: string; note?: string }>;

/**
 * Stav balíku zdrojů: přidání nic nenahradí, zpracování jde postupně (jedno po druhém),
 * chyba jedné položky nezahodí ostatní, zrušené položky se nepřepíšou pozdním výsledkem.
 */
export function useSourceBundle(audience: SourceAudience = "teacher", onReject?: (msg: string) => void) {
  const [items, setItems] = useState<SourceItem[]>([]);
  const loaders = useRef(new Map<string, Loader>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const patch = (id: string, p: Partial<SourceItem>) =>
    alive.current && setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const run = useCallback((id: string) => {
    queue.current = queue.current.then(async () => {
      const load = loaders.current.get(id);
      if (!load) return; // mezitím odebráno
      patch(id, { status: "loading", error: undefined });
      try {
        const r = await load();
        if (!loaders.current.has(id)) return;
        patch(id, { status: "ready", text: r.text, origin: r.origin ?? undefined, error: r.note });
      } catch (e) {
        if (!loaders.current.has(id)) return;
        patch(id, { status: "error", error: e instanceof Error ? e.message : "Zdroj se nepodařilo načíst." });
      }
    });
    return queue.current;
  }, []);

  const push = (entries: { kind: SourceKind; label: string; origin?: string; load: Loader }[]) => {
    const created = entries.map((e) => ({ id: crypto.randomUUID(), ...e }));
    setItems((prev) => [...prev, ...created.map(({ id, kind, label, origin }) => ({ id, kind, label, origin, status: "loading" as const }))]);
    created.forEach((c) => { loaders.current.set(c.id, c.load); void run(c.id); });
  };

  const addFiles = (files: File[]) => {
    const list = Array.from(files); // snapshot před vyprázdněním inputu
    const incoming = list.map((f) => ({ kind: kindForFile(f), size: f.size, name: f.name }));
    const err = checkAddBatch(items, incoming);
    if (err) { onReject?.(err); return false; }
    push(list.map((f, i) => {
      const kind = incoming[i].kind!;
      return { kind, label: f.name || SOURCE_KIND_LABEL[kind], origin: f.name, load: async () => ({ text: await extractFileSource(f, kind) }) };
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
    push([{ kind: "url", label: url.trim(), load: () => extractUrlSource(url.trim()) }]);
    return true;
  };

  const addLesson = (title: string, getText: () => Promise<string> | string) => {
    const err = checkAddBatch(items, [{ kind: "lesson" }]);
    if (err) { onReject?.(err); return false; }
    push([{ kind: "lesson", label: title, origin: title, load: async () => ({ text: (await getText()).trim() }) }]);
    return true;
  };

  const remove = (id: string) => { loaders.current.delete(id); setItems((p) => p.filter((i) => i.id !== id)); };
  const move = (id: string, delta: number) => setItems((p) => moveSource(p, id, delta));
  const retry = (id: string) => void run(id);
  const updateText = (id: string, text: string) => patch(id, { text, error: undefined });
  const clear = () => { loaders.current.clear(); setItems([]); };

  const state = useMemo(() => bundleState(items, audience), [items, audience]);
  return { items, state, audience, addFiles, addText, addUrl, addLesson, remove, move, retry, updateText, clear };
}

export type SourceBundle = ReturnType<typeof useSourceBundle>;
