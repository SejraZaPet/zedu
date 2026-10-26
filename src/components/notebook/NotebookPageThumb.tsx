import { useEffect, useRef, useState } from "react";
import { BackgroundStyle, NB_H, NB_W, NotebookPageContent, backgroundCss, renderStroke, signNotebookImages } from "@/lib/notebook";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { drawNotebookTextBox } from "@/lib/notebook-rich-text";

interface Props {
  content: NotebookPageContent;
  backgroundStyle: BackgroundStyle;
  className?: string;
}

/**
 * Lehká miniatura stránky. Obrázky (např. stránka pracovního listu) jsou jen
 * zobrazovací vrstva <img> pod tahy, načtená líně; do obsahu se nic nezapisuje.
 */
const NotebookPageThumb = ({ content, backgroundStyle, className }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const images = content.images ?? [];
  const pathsKey = images.map((i) => i.path).join("|");

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !pathsKey) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [pathsKey]);

  useEffect(() => {
    if (!visible || !pathsKey) return;
    let alive = true;
    signNotebookImages(pathsKey.split("|"))
      .then((map) => { if (alive) setUrls(map); })
      .catch(() => { /* miniatura zůstane bez obrázku */ });
    return () => { alive = false; };
  }, [visible, pathsKey]);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const w = cvs.clientWidth || 96;
    const h = cvs.clientHeight || Math.round((w * NB_H) / NB_W);
    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.max(1, Math.floor(w * dpr));
    cvs.height = Math.max(1, Math.floor(h * dpr));
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of content.strokes) renderStroke(ctx, s, w, h);
    for (const tb of content.textBoxes) drawNotebookTextBox(ctx, tb, w, h, w / NB_W);
  }, [content]);

  return (
    <div
      ref={boxRef}
      className={cn("relative w-full overflow-hidden rounded border bg-white", className)}
      style={{ aspectRatio: `${NB_W} / ${NB_H}`, ...backgroundCss(backgroundStyle, 0.12) }}
    >
      {images.map((img) => urls[img.path] ? (
        <img
          key={img.id}
          data-thumb-image
          src={urls[img.path]}
          alt=""
          aria-hidden
          draggable={false}
          loading="lazy"
          className="pointer-events-none absolute select-none object-fill"
          style={{ left: `${img.x * 100}%`, top: `${img.y * 100}%`, width: `${img.w * 100}%`, height: `${img.h * 100}%` }}
        />
      ) : null)}
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {content.worksheet?.mode === "digital" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-card/90 p-1 text-center">
          <FileText className="h-5 w-5 text-primary" aria-hidden />
          <span className="line-clamp-3 text-[9px] font-medium leading-tight text-foreground">{content.worksheet.title}</span>
        </div>
      )}
    </div>
  );
};

export default NotebookPageThumb;
