import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FormulaRenderer from "@/components/blocks/FormulaRenderer";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const EXAMPLES = [
  { label: "Mocnina", latex: "a^2 + b^2 = c^2" },
  { label: "Zlomek", latex: "\\frac{m}{V} = \\rho" },
  { label: "Chemie", latex: "H_2O + CO_2" },
  { label: "Odmocnina", latex: "\\sqrt{x^2 + y^2}" },
];

const FormulaBlock = ({ block, onChange }: Props) => {
  const latex = block.props?.latex || "";

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">LaTeX zápis</Label>
        <Textarea
          rows={2}
          className="mt-1 font-mono text-xs"
          value={latex}
          onChange={(e) => onChange({ ...block.props, latex: e.target.value })}
          placeholder="např. a^2 + b^2 = c^2"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => onChange({ ...block.props, latex: ex.latex })}
            className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
          >
            {ex.label}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3 text-foreground">
        <FormulaRenderer latex={latex} />
      </div>
    </div>
  );
};

export default FormulaBlock;
