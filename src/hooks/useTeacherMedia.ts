import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMedia, MEDIA_BUCKET, type TeacherMediaItem } from "@/lib/teacher-media";

/** Cache of signed URLs keyed by storage_path. */
const urlCache = new Map<string, { url: string; expires: number }>();

export function useTeacherMedia(teacherId: string | undefined) {
  const [items, setItems] = useState<TeacherMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!teacherId) return;
    let cancelled = false;
    setLoading(true);
    listMedia(teacherId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teacherId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, loading, reload, setItems };
}

/** Fetch signed URLs for a list of paths, batched. */
export function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const last = useRef<string>("");

  useEffect(() => {
    const sig = paths.join("|");
    if (sig === last.current) return;
    last.current = sig;

    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      const now = Date.now();
      const need: string[] = [];
      for (const p of paths) {
        const cached = urlCache.get(p);
        if (cached && cached.expires > now) next[p] = cached.url;
        else need.push(p);
      }
      // Batch sign via createSignedUrls
      if (need.length > 0) {
        const { data } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrls(need, 3600);
        for (const row of data ?? []) {
          if (row.path && row.signedUrl) {
            next[row.path] = row.signedUrl;
            urlCache.set(row.path, { url: row.signedUrl, expires: now + 3500 * 1000 });
          }
        }
      }
      if (!cancelled) setUrls(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [paths]);

  return urls;
}
