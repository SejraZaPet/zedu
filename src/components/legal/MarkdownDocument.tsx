import { Fragment, useMemo } from "react";
import { parseInline, parseMarkdown, safeHref, type MdBlock } from "@/lib/simple-markdown";

function InlineText({ text }: { text: string }) {
  return <>{parseInline(text).map((p, i) =>
    p.t === "bold" ? <strong key={i}>{p.v}</strong>
    : p.t === "link" ? <a key={i} href={safeHref(p.href)} className="text-primary hover:underline">{p.v}</a>
    : <Fragment key={i}>{p.v}</Fragment>)}</>;
}

export default function MarkdownDocument({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  const toc = blocks.filter((b): b is Extract<MdBlock, { type: "heading" }> => b.type === "heading" && b.level === 2);
  return (
    <div className="legal-doc space-y-4 text-foreground">
      {toc.length > 1 && (
        <nav aria-label="Obsah" className="rounded-lg border bg-muted/40 p-4 print:hidden">
          <h2 className="font-heading text-base font-semibold mb-2">Obsah</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-primary hover:underline">{h.text.replace(/\*\*/g, "")}</a></li>)}
          </ol>
        </nav>
      )}
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          const Tag = (`h${b.level}`) as "h2" | "h3" | "h4";
          return <Tag key={i} id={b.id} className={`font-heading font-semibold scroll-mt-24 ${b.level === 2 ? "text-xl mt-8" : "text-lg mt-5"}`}><InlineText text={b.text} /></Tag>;
        }
        if (b.type === "paragraph") return <p key={i} className="leading-relaxed"><InlineText text={b.text} /></p>;
        if (b.type === "list") {
          const L = b.ordered ? "ol" : "ul";
          return <L key={i} className={`${b.ordered ? "list-decimal" : "list-disc"} pl-6 space-y-1`}>{b.items.map((it, j) => <li key={j}><InlineText text={it} /></li>)}</L>;
        }
        return (
          <div key={i} data-testid="legal-table-wrap" className="w-full max-w-full overflow-x-auto rounded-md border print:overflow-visible">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-muted/50"><tr>{b.header.map((c, j) => <th key={j} scope="col" className="text-left font-semibold p-2 border-b align-top"><InlineText text={c} /></th>)}</tr></thead>
              <tbody>{b.rows.map((r, j) => <tr key={j} className="border-b last:border-0">{r.map((c, k) => <td key={k} className="p-2 align-top"><InlineText text={c} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
