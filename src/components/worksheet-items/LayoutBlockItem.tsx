import { Info, Video, PenLine, MessageCircle, Users } from "lucide-react";
import type { WorksheetItemProps } from "./types";
import type { InstructionIcon } from "@/lib/worksheet-spec";
import { getWriteLineCount, getWriteLineHeightMm, WRITE_LINE_HEIGHT_MM, getBlankBoxHeightMm, blankBoxBackgroundCss } from "@/lib/worksheet-write-lines";
import { QRCodeSVG } from "qrcode.react";

const ICONS: Record<InstructionIcon, typeof Info> = {
  info: Info,
  video: Video,
  write: PenLine,
  discuss: MessageCircle,
  group: Users,
};

const VARIANT_CLASS: Record<string, string> = {
  blue: "bg-blue-50 border-blue-300 text-blue-900",
  yellow: "bg-amber-50 border-amber-300 text-amber-900",
  green: "bg-emerald-50 border-emerald-300 text-emerald-900",
  purple: "bg-purple-50 border-purple-300 text-purple-900",
};

/**
 * Renderer pro layoutové bloky (section_header, write_lines, instruction_box,
 * two_boxes, qr_link, flow_steps). `write_lines` a `two_boxes` (pole s linkami) jsou psatelné —
 * text se ukládá pod item.id (u two_boxes jako [levé, pravé]); neznámkuje se automaticky.
 */
/** Hodnota pro `two_boxes` — dvě samostatná pole [levé, pravé]. */
export function twoBoxesValue(v: unknown): [string, string] {
  if (Array.isArray(v)) return [String(v[0] ?? ""), String(v[1] ?? "")];
  return ["", ""];
}

/** Obsahuje odpověď psacího bloku nějaký text? */
export function hasWrittenText(v: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => String(x ?? "").trim() !== "");
  return typeof v === "string" && v.trim() !== "";
}

/** CSS text `a:b;c:d` → React style objekt. */
function cssToStyle(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of css.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key) out[key] = part.slice(i + 1).trim();
  }
  return out as React.CSSProperties;
}

function LinedTextarea({
  lines, value, onChange, disabled, label, lineStyle = "dotted", lineMm = WRITE_LINE_HEIGHT_MM,
}: { lines: number; value: string; onChange: (v: string) => void; disabled: boolean; label: string; lineStyle?: string; lineMm?: number }) {
  return (
    <textarea
      aria-label={label}
      value={value}
      readOnly={disabled}
      onChange={(e) => onChange(e.target.value)}
      rows={lines}
      className="block w-full resize-none bg-transparent px-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      style={{
        lineHeight: `${lineMm}mm`,
        minHeight: `${lines * lineMm}mm`,
        backgroundImage: `linear-gradient(to bottom, transparent calc(${lineMm}mm - 1px), hsl(var(--border)) calc(${lineMm}mm - 1px))`,
        backgroundSize: `100% ${lineMm}mm`,
      }}
    />
  );
}

export default function LayoutBlockItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  // Editor / náhled bez odpovědi předává disabled bez hodnoty → statické linky jako dřív.
  const writable = !disabled || hasWrittenText(value);
  switch (item.type) {
    case "section_header":
      return (
        <div className="border-b-2 border-foreground/80 pb-1 mb-2">
          <h3 className="text-lg font-bold">{item.prompt}</h3>
        </div>
      );

    case "write_lines": {
      const count = getWriteLineCount(item);
      const style = item.lineStyle ?? "dotted";
      const lineMm = getWriteLineHeightMm(item);
      if (writable) {
        return (
          <div className="space-y-1">
            {item.prompt && <p className="text-sm text-muted-foreground">{item.prompt}</p>}
            <LinedTextarea
              lines={count}
              lineStyle={style}
              lineMm={lineMm}
              value={typeof value === "string" ? value : ""}
              onChange={(v) => onChange(v)}
              disabled={disabled}
              label={item.prompt || "Linky pro psaní"}
            />
          </div>
        );
      }
      return (
        <div className="space-y-1">
          {item.prompt && <p className="text-sm text-muted-foreground">{item.prompt}</p>}
          <div data-testid="write-lines-static">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{ height: `${lineMm}mm`, borderBottom: `1px ${style} hsl(var(--border))` }}
              />
            ))}
          </div>
        </div>
      );
    }

    case "instruction_box": {
      const Icon = ICONS[item.instructionIcon ?? "info"];
      const variant = VARIANT_CLASS[item.instructionVariant ?? "blue"];
      return (
        <div className={`rounded-lg border p-3 flex gap-3 items-start ${variant}`}>
          <Icon className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{item.prompt}</p>
        </div>
      );
    }

    case "two_boxes": {
      const vals = twoBoxesValue(value);
      const renderContent = (content: string | undefined, side: 0 | 1, title?: string) => {
        const match = content?.match(/^lines:(\d+)$/);
        if (match && writable) {
          const n = parseInt(match[1], 10);
          return (
            <LinedTextarea
              lines={n}
              value={vals[side]}
              onChange={(v) => {
                const next: [string, string] = [...vals] as [string, string];
                next[side] = v;
                onChange(next);
              }}
              disabled={disabled}
              label={title || (side === 0 ? "Levé pole" : "Pravé pole")}
            />
          );
        }
        if (match) {
          const n = parseInt(match[1], 10);
          return (
            <div>
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="border-b border-dotted border-border" style={{ height: `${WRITE_LINE_HEIGHT_MM}mm` }} />
              ))}
            </div>
          );
        }
        return <p className="text-sm whitespace-pre-wrap">{content}</p>;
      };
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <h4 className="font-semibold text-sm mb-2">{item.leftTitle}</h4>
              {renderContent(item.leftContent, 0, item.leftTitle)}
            </div>
            <div className="rounded-lg border border-border p-3">
              <h4 className="font-semibold text-sm mb-2">{item.rightTitle}</h4>
              {renderContent(item.rightContent, 1, item.rightTitle)}
            </div>
          </div>
        </div>
      );
    }

    case "blank_box": {
      const h = getBlankBoxHeightMm(item);
      const bg = cssToStyle(blankBoxBackgroundCss(item.blankStyle));
      const label = item.prompt?.trim();
      return (
        <div className="space-y-1" data-testid="blank-box">
          {label && <p className="text-sm text-muted-foreground">{label}</p>}
          {writable ? (
            <textarea
              aria-label={label || "Prázdné místo"}
              value={typeof value === "string" ? value : ""}
              readOnly={disabled}
              onChange={(e) => onChange(e.target.value)}
              className="block w-full resize-none rounded-sm border border-border bg-transparent p-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ height: `${h}mm`, lineHeight: `${WRITE_LINE_HEIGHT_MM}mm`, ...bg }}
            />
          ) : (
            <div className="rounded-sm border border-border" style={{ height: `${h}mm`, ...bg }} />
          )}
        </div>
      );
    }

    case "qr_link":
      return (
        <div className="flex items-center gap-4 rounded-lg border border-border p-3">
          {item.qrUrl ? (
            <QRCodeSVG value={item.qrUrl} size={96} />
          ) : (
            <div className="w-24 h-24 bg-muted rounded grid place-items-center text-xs text-muted-foreground">
              QR
            </div>
          )}
          <div className="text-sm">
            <p className="font-medium">{item.prompt}</p>
            {item.qrUrl && (
              <a
                href={item.qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline break-all"
              >
                {item.qrUrl}
              </a>
            )}
          </div>
        </div>
      );

    case "flow_steps": {
      const steps = item.flowSteps ?? [];
      const horizontal = item.flowDirection === "horizontal";
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div
            className={
              horizontal
                ? "flex flex-wrap items-center gap-2"
                : "flex flex-col items-center gap-2"
            }
          >
            {steps.map((step, i) => (
              <div key={i} className="contents">
                <div className="border-2 border-primary rounded-lg px-4 py-2 text-sm font-medium text-center">
                  {step}
                </div>
                {i < steps.length - 1 && (
                  <span className="text-muted-foreground text-lg">
                    {horizontal ? "→" : "↓"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
