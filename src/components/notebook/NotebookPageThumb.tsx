import { useEffect, useRef } from "react";
import { BackgroundStyle, NB_H, NB_W, NotebookPageContent, backgroundCss, renderStroke } from "@/lib/notebook";
import { cn } from "@/lib/utils";

interface Props {
  content: NotebookPageContent;
  backgroundStyle: BackgroundStyle;
  className?: string;
}

/** Lehká miniatura stránky — kresba (bez obrázků) na podkladu šablony. */
const NotebookPageThumb = ({ content, backgroundStyle, className }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);

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
    for (const tb of content.textBoxes) {
      ctx.save();
      ctx.fillStyle = tb.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(tb.x * w, tb.y * h, Math.max(2, tb.w * w), Math.max(2, (tb.fontSize / NB_H) * h));
      ctx.restore();
    }
  }, [content]);

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded border bg-white", className)}
      style={{ aspectRatio: `${NB_W} / ${NB_H}`, ...backgroundCss(backgroundStyle, 0.12) }}
    >
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
};

export default NotebookPageThumb;
