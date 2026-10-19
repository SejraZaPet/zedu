import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signNotebookImages } from "@/lib/notebook";

/** Signed URLs are view state only: never write them back into notebook content. */
export default function NotebookImageContent({ path, locked }: { path: string; locked?: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false);
  const generation = useRef(0);
  const automaticRetryUsed = useRef(false);

  const renew = useCallback(async () => {
    const current = ++generation.current;
    setError(false);
    setLoading(true);
    setUrl("");
    // One retry only; persistent permission/missing-file errors must remain visible.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const urls = await signNotebookImages([path], { strict: true });
        if (!alive.current || generation.current !== current) return;
        setUrl(urls[path]);
        return;
      } catch {
        if (!alive.current || generation.current !== current) return;
        if (attempt === 0 && !automaticRetryUsed.current) {
          automaticRetryUsed.current = true;
          continue;
        }
        setLoading(false);
        setError(true);
        return;
      }
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    automaticRetryUsed.current = false;
    void renew();
    // Refresh ahead of the one-hour expiry, including after a suspended tab wakes.
    const refresh = () => {
      automaticRetryUsed.current = false;
      void renew();
    };
    const interval = window.setInterval(refresh, 55 * 60 * 1000);
    let signedAt = Date.now();
    const visible = () => {
      if (document.visibilityState === "visible" && Date.now() - signedAt >= 55 * 60 * 1000) {
        signedAt = Date.now();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      generation.current++;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [renew]);

  const failed = useCallback(() => {
    if (automaticRetryUsed.current) {
      generation.current++;
      setLoading(false);
      setError(true);
    } else {
      automaticRetryUsed.current = true;
      void renew();
    }
  }, [renew]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(failed, 20_000);
    return () => window.clearTimeout(timer);
  }, [loading, url, failed]);

  if (error) return (
    <div role="alert" className="relative z-20 flex h-full w-full flex-col items-center justify-center gap-3 overflow-auto bg-muted p-3 text-center text-sm text-foreground pointer-events-auto"
      onPointerDown={(event) => event.stopPropagation()}>
      <p>{locked ? "Stránka pracovního listu se nenačetla." : "Obrázek v sešitě se nenačetl."} Tvoje zápisky zůstávají zachované.</p>
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => {
        automaticRetryUsed.current = false;
        void renew();
      }}><RotateCcw className="h-4 w-4" /> Zkusit znovu</Button>
    </div>
  );

  return <>
    {url && <img key={url} src={url} alt={locked ? "Stránka pracovního listu" : "Vložený obrázek v sešitu"}
      className="h-full w-full select-none object-contain" draggable={false}
      onLoad={() => setLoading(false)} onError={failed} />}
    {loading && <div role="status" aria-label="Načítání obrázku" className="absolute inset-0 flex items-center justify-center bg-muted">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>}
  </>;
}