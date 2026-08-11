import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartDatum {
  label: string;
  value: number;
}

const PALETTE = ["#6EC6D9", "#9B6CFF", "#F59E0B", "#10B981", "#EF4444", "#3B82F6", "#F472B6", "#64748B"];

interface Props {
  chartKind?: string;
  title?: string;
  data?: ChartDatum[];
  height?: number;
}

/** Jednoduchý sloupcový / kruhový graf pro slidy a učebnice. */
const ChartRenderer = ({ chartKind = "bar", title, data, height = 280 }: Props) => {
  const rows = (Array.isArray(data) ? data : [])
    .filter((d) => d && String(d.label ?? "").trim() !== "")
    .map((d) => ({ label: String(d.label), value: Number(d.value) || 0 }));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-current/30 p-6 text-center text-sm opacity-60">
        Zadejte data grafu (popisek a hodnotu).
      </div>
    );
  }

  return (
    <figure className="w-full">
      {title && <figcaption className="mb-2 text-center text-lg font-semibold">{title}</figcaption>}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartKind === "pie" ? (
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="label" outerRadius="75%" label>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={rows}>
              <XAxis dataKey="label" stroke="currentColor" tick={{ fill: "currentColor" }} />
              <YAxis stroke="currentColor" tick={{ fill: "currentColor" }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
};

export default ChartRenderer;
