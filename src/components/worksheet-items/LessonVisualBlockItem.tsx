import DOMPurify from "dompurify";
import type { CSSProperties } from "react";
import type { WorksheetItemProps } from "./types";

const WIDTH_CLASS = {
  full: "w-full",
  medium: "w-1/2",
  small: "w-1/3",
} as const;

const ALIGN_CLASS = {
  left: "mr-auto text-left",
  center: "mx-auto text-center",
  right: "ml-auto text-right",
} as const;

const CALLOUT_CLASS: Record<string, { icon: string; className: string }> = {
  note: { icon: "📝", className: "border-muted-foreground/40 bg-muted/40" },
  info: { icon: "ℹ️", className: "border-muted-foreground/40 bg-muted/40" },
  warning: { icon: "⚠️", className: "border-destructive/40 bg-destructive/10" },
  tip: { icon: "💡", className: "border-primary/40 bg-primary/10" },
  remember: { icon: "🧠", className: "border-primary/40 bg-primary/10" },
  custom: { icon: "📌", className: "border-border bg-muted/40" },
};

function SafeContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

export default function LessonVisualBlockItem({ item }: WorksheetItemProps) {
  if (item.type === "image") {
    if (!item.imageUrl) return null;
    const width = WIDTH_CLASS[item.imageWidth ?? "full"];
    const align = ALIGN_CLASS[item.imageAlignment ?? "center"];
    return (
      <figure className={`${width} ${align}`}>
        <img src={item.imageUrl} alt={item.imageAlt || item.imageCaption || ""} className="h-auto w-full rounded-lg" />
        {item.imageCaption && <figcaption className="mt-2 text-sm text-muted-foreground">{item.imageCaption}</figcaption>}
      </figure>
    );
  }

  if (item.type === "image_text") {
    return (
      <div className={`flex flex-col gap-6 md:flex-row ${item.imagePosition === "right" ? "md:flex-row-reverse" : ""}`}>
        {item.imageUrl && <div className="md:w-1/2"><img src={item.imageUrl} alt={item.imageAlt || ""} className="h-auto w-full rounded-lg object-cover" /></div>}
        <SafeContent html={item.imageText || ""} className="whitespace-pre-wrap text-foreground leading-relaxed md:w-1/2" />
      </div>
    );
  }

  if (item.type === "gallery") {
    const cols = item.galleryColumns ?? 3;
    const colClass = cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3";
    return (
      <div className={`grid gap-3 ${colClass}`}>
        {(item.galleryImages ?? []).filter((image) => image.url).map((image, index) => (
          <figure key={`${image.url}-${index}`} className="text-center">
            <img src={image.url} alt={image.alt || image.caption || ""} className="h-auto w-full rounded-lg bg-muted/30 object-contain" />
            {image.caption && <figcaption className="mt-1 text-xs text-muted-foreground">{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }

  if (item.type === "callout") {
    const visual = CALLOUT_CLASS[item.calloutVariant ?? "note"] ?? CALLOUT_CLASS.note;
    const style: CSSProperties | undefined = item.calloutBackgroundColor
      ? { backgroundColor: item.calloutBackgroundColor, borderLeftColor: item.calloutAccentColor || item.calloutBackgroundColor }
      : undefined;
    return (
      <div className={`flex gap-3 rounded-lg border-l-4 p-4 ${visual.className}`} style={style}>
        <span className="shrink-0 text-xl" aria-hidden="true">{visual.icon}</span>
        <div className="min-w-0">
          {item.calloutTitle && <h4 className="mb-1 font-semibold text-foreground">{item.calloutTitle}</h4>}
          <SafeContent html={item.calloutText || item.prompt || ""} className="text-sm leading-relaxed text-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5" />
        </div>
      </div>
    );
  }

  return null;
}