import type { Block } from "@/lib/textbook-config";
import LessonLinkButton from "@/components/LessonLinkButton";

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

export const LessonBlock = ({ block }: { block: Block }) => {
  const p = block.props;

  switch (block.type) {
    case "heading": {
      const Tag = `h${p.level || 2}` as keyof JSX.IntrinsicElements;
      return <Tag className="font-heading text-2xl md:text-3xl font-semibold text-foreground">{p.text}</Tag>;
    }
    case "paragraph":
      return <p className="text-foreground leading-relaxed whitespace-pre-wrap">{p.text}</p>;
    case "bullet_list":
      return (
        <ul className="list-disc list-inside space-y-1 text-foreground">
          {(p.items as string[])?.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "image":
      return (
        <figure className={`${p.alignment === "center" ? "text-center" : ""}`}>
          <img
            src={p.url}
            alt={p.caption || ""}
            className={`rounded-lg ${p.width === "full" ? "w-full" : p.width === "half" ? "w-1/2 inline-block" : "w-1/3 inline-block"}`}
          />
          {p.caption && <figcaption className="text-sm text-muted-foreground mt-2">{p.caption}</figcaption>}
        </figure>
      );
    case "image_text":
      return (
        <div className={`flex flex-col md:flex-row gap-6 ${p.imagePosition === "right" ? "md:flex-row-reverse" : ""}`}>
          <div className="md:w-1/2">
            <img src={p.imageUrl} alt="" className="rounded-lg w-full object-cover" />
          </div>
          <div className="md:w-1/2 text-foreground leading-relaxed whitespace-pre-wrap">{p.text}</div>
        </div>
      );
    case "card_grid":
      return (
        <div className={`grid gap-4 ${(p.columns || 2) === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
          {(p.cards as { title: string; text: string }[])?.map((card, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-heading text-lg font-semibold mb-2 text-card-foreground">{card.title}</h4>
              <p className="text-sm text-muted-foreground">{card.text}</p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {(p.headers as string[])?.map((h, i) => (
                  <th key={i} className="border border-border bg-muted px-4 py-2 text-left text-sm font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(p.rows as string[][])?.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-4 py-2 text-sm text-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "accordion":
      return (
        <div className="space-y-2">
          {(p.items as { title: string; content: string }[])?.map((item, i) => (
            <details key={i} className="border border-border rounded-lg">
              <summary className="px-4 py-3 cursor-pointer font-medium text-foreground hover:text-primary">
                {item.title}
              </summary>
              <div className="px-4 pb-3 text-sm text-muted-foreground">{item.content}</div>
            </details>
          ))}
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary pl-4 py-2 italic text-foreground">
          <p>{p.text}</p>
          {p.author && <cite className="text-sm text-muted-foreground not-italic">— {p.author}</cite>}
        </blockquote>
      );
    case "lesson_link":
      return <LessonLinkButton lessonId={p.lessonId} buttonText={p.buttonText} />;
    case "youtube": {
      const ytId = extractYouTubeId(p.url || "");
      if (!ytId) return null;
      const widthClass = p.width === "half" ? "max-w-sm" : p.width === "three_quarter" ? "max-w-2xl" : "w-full";
      return (
        <figure className={`mx-auto ${widthClass}`}>
          <div className="aspect-video w-full rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}`}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={p.caption || "YouTube video"}
            />
          </div>
          {p.caption && <figcaption className="text-sm text-muted-foreground mt-2 text-center">{p.caption}</figcaption>}
        </figure>
      );
    }
    default:
      return null;
  }
};

export default LessonBlock;
