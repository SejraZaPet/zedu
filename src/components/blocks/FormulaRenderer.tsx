import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface Props {
  latex?: string;
  /** Vykreslit jako blok na střed (výchozí) nebo inline. */
  display?: boolean;
  className?: string;
}

/** Vykreslení matematického zápisu v LaTeXu pomocí KaTeX. */
const FormulaRenderer = ({ latex, display = true, className }: Props) => {
  const { html, error } = useMemo(() => {
    const src = (latex || "").trim();
    if (!src) return { html: "", error: null as string | null };
    try {
      return {
        html: katex.renderToString(src, { displayMode: display, throwOnError: true, output: "html" }),
        error: null as string | null,
      };
    } catch (e: any) {
      return { html: "", error: e?.message ? String(e.message) : "Neplatný LaTeX zápis." };
    }
  }, [latex, display]);

  if (!html) {
    return (
      <div className={`rounded-lg border border-dashed border-current/30 p-4 text-center text-sm opacity-60 ${className || ""}`}>
        {error ? `Chyba ve vzorci: ${error}` : "Zadejte vzorec v LaTeXu, např. a^2 + b^2 = c^2"}
      </div>
    );
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default FormulaRenderer;
