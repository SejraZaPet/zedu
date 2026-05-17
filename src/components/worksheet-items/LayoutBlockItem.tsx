import { Info, Video, PenLine, MessageCircle, Users } from "lucide-react";
import type { WorksheetItemProps } from "./types";
import type { InstructionIcon } from "@/lib/worksheet-spec";
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
 * two_boxes, qr_link, flow_steps). Slouží pouze pro zobrazení v online náhledu —
 * neukládá žádnou odpověď.
 */
export default function LayoutBlockItem({ item }: WorksheetItemProps) {
  switch (item.type) {
    case "section_header":
      return (
        <div className="border-b-2 border-foreground/80 pb-1 mb-2">
          <h3 className="text-lg font-bold">{item.prompt}</h3>
        </div>
      );

    case "write_lines": {
      const count = Math.max(1, Math.min(20, item.lineCount ?? 3));
      const style = item.lineStyle ?? "dotted";
      return (
        <div className="space-y-1">
          {item.prompt && <p className="text-sm text-muted-foreground">{item.prompt}</p>}
          <div className="space-y-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="h-7"
                style={{ borderBottom: `1px ${style} hsl(var(--border))` }}
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
      const renderContent = (content?: string) => {
        const match = content?.match(/^lines:(\d+)$/);
        if (match) {
          const n = parseInt(match[1], 10);
          return (
            <div className="space-y-1.5">
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="h-6 border-b border-dotted border-border" />
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
              {renderContent(item.leftContent)}
            </div>
            <div className="rounded-lg border border-border p-3">
              <h4 className="font-semibold text-sm mb-2">{item.rightTitle}</h4>
              {renderContent(item.rightContent)}
            </div>
          </div>
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
