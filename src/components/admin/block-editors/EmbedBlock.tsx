import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import type { Block } from "@/lib/textbook-config";
import {
  EMBED_ALLOWED_LABEL,
  EMBED_ASPECT_OPTIONS,
  embedAspectRatio,
  isAllowedEmbedUrl,
} from "@/lib/embed-allowlist";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const EmbedBlock = ({ block, onChange }: Props) => {
  const p = block.props || {};
  const url = (p.url || "").toString();
  const allowed = isAllowedEmbedUrl(url);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Odkaz na externí nástroj</Label>
        <Input
          className="mt-1"
          value={url}
          onChange={(e) => onChange({ ...p, url: e.target.value })}
          placeholder="https://www.geogebra.org/material/iframe/id/…"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Povolené služby: {EMBED_ALLOWED_LABEL}
        </p>
      </div>
      <div>
        <Label className="text-xs">Název (pro čtečky a popisek)</Label>
        <Input
          className="mt-1"
          value={p.title || ""}
          onChange={(e) => onChange({ ...p, title: e.target.value })}
          placeholder="např. Simulace tlaku v PhET"
        />
      </div>
      <div>
        <Label className="text-xs">Poměr stran</Label>
        <select
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={p.aspectRatio || "16:9"}
          onChange={(e) => onChange({ ...p, aspectRatio: e.target.value })}
        >
          {EMBED_ASPECT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {url && !allowed && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Tuhle doménu appka nepovoluje vložit. Použijte odkaz z: {EMBED_ALLOWED_LABEL}.</span>
        </div>
      )}
      {allowed && (
        <div
          className="w-full overflow-hidden rounded-lg border border-border"
          style={{ aspectRatio: embedAspectRatio(p.aspectRatio) }}
        >
          <iframe
            src={url}
            title={p.title || "Externí nástroj"}
            className="h-full w-full"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      )}
    </div>
  );
};

export default EmbedBlock;
