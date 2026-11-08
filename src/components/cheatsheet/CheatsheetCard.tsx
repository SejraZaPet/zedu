import type { CheatsheetData } from "@/lib/cheatsheet";
export default function CheatsheetCard({ data, side }: { data: CheatsheetData; side: "front" | "back" }) {
  return <article aria-label={`Tahák – ${side === "front" ? "líc" : "rub"}`} className="cheatsheet-card border border-border bg-card text-card-foreground rounded-md">
    <header className="text-xs font-bold break-words">{data.title}{data.subject && <span className="font-normal text-muted-foreground"> · {data.subject}</span>}</header>
    <div className={`cheatsheet-text cheatsheet-font-${data.fontPt}`}>{data[side]}</div>
  </article>;
}