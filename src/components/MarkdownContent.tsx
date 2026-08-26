import { useState, type JSX } from "react";
import { X } from "lucide-react";

/**
 * Mini markdown renderer: ## / ### nadpisy, odrážky, číslované seznamy,
 * **tučné**, [odkazy](url) a ![obrázky](url) s lightboxem.
 */

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/;

const renderInline = (text: string, key: string): (JSX.Element | string)[] => {
  const out: (JSX.Element | string)[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(
        <strong key={`${key}-b${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>,
      );
      return;
    }
    const link = part.match(LINK_RE);
    if (link && part.startsWith("[")) {
      out.push(
        <a
          key={`${key}-a${i}`}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {link[1]}
        </a>,
      );
      return;
    }
    out.push(part);
  });
  return out;
};

interface Props {
  content: string;
  className?: string;
}

const MarkdownContent = ({ content, className }: Props) => {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const blocks: JSX.Element[] = [];
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  let list: string[] = [];
  let ordered: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-6 space-y-1 text-muted-foreground mb-4">
        {list.map((li, i) => <li key={i}>{renderInline(li, `ul${blocks.length}-${i}`)}</li>)}
      </ul>,
    );
    list = [];
  };
  const flushOrdered = () => {
    if (!ordered.length) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="list-decimal pl-6 space-y-1 text-muted-foreground mb-4">
        {ordered.map((li, i) => <li key={i}>{renderInline(li, `ol${blocks.length}-${i}`)}</li>)}
      </ol>,
    );
    ordered = [];
  };
  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-base leading-relaxed text-muted-foreground mb-4 whitespace-pre-wrap">
        {para.map((l, i) => (
          <span key={i}>
            {renderInline(l, `p${blocks.length}-${i}`)}
            {i < para.length - 1 ? "\n" : null}
          </span>
        ))}
      </p>,
    );
    para = [];
  };
  const flushAll = () => { flushList(); flushOrdered(); flushPara(); };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushAll(); return; }

    const img = line.match(IMG_RE);
    if (img && line.startsWith("![")) {
      flushAll();
      const src = img[2];
      const alt = img[1];
      blocks.push(
        <button
          key={`img-${blocks.length}`}
          type="button"
          onClick={() => setLightbox({ src, alt })}
          className="block w-full text-left"
          aria-label={alt ? `Zvětšit obrázek: ${alt}` : "Zvětšit obrázek"}
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="rounded-lg max-w-full my-4 border border-border shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity"
          />
        </button>,
      );
      return;
    }

    if (line.startsWith("### ")) {
      flushAll();
      blocks.push(<h3 key={`h3-${blocks.length}`} className="font-heading text-lg font-semibold mt-6 mb-2 text-foreground">{renderInline(line.slice(4), `h3${blocks.length}`)}</h3>);
      return;
    }
    if (line.startsWith("## ")) {
      flushAll();
      blocks.push(<h2 key={`h2-${blocks.length}`} className="font-heading text-xl font-semibold mt-8 mb-3 text-foreground">{renderInline(line.slice(3), `h2${blocks.length}`)}</h2>);
      return;
    }
    if (line.startsWith("# ")) {
      flushAll();
      blocks.push(<h2 key={`h1-${blocks.length}`} className="font-heading text-2xl font-bold mt-8 mb-3 text-foreground">{renderInline(line.slice(2), `h1${blocks.length}`)}</h2>);
      return;
    }
    if (/^\d+[.)]\s+/.test(line)) { flushList(); flushPara(); ordered.push(line.replace(/^\d+[.)]\s+/, "")); return; }
    if (/^[-*]\s+/.test(line)) { flushOrdered(); flushPara(); list.push(line.replace(/^[-*]\s+/, "")); return; }
    flushList(); flushOrdered();
    para.push(line);
  });
  flushAll();

  return (
    <div className={className ?? "max-w-none"}>
      {blocks}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-background/90 text-foreground"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-[90vh] max-w-full rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default MarkdownContent;
