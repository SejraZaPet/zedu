import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileIcon, Film, Image as ImageIcon, Music, Paperclip } from "lucide-react";
import {
  AssignmentMaterial,
  formatBytes,
  mediaKindOf,
  signedMaterialUrl,
} from "@/lib/assignment-materials";

interface Props {
  materials: AssignmentMaterial[];
  title?: string;
}

/** Materiály od učitele u zadání úkolu – obrázky, video a zvuk s náhledem, ostatní jako odkaz. */
const AssignmentMaterialsList = ({ materials, title = "Materiály k úkolu" }: Props) => {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const m of materials) {
        if (m.kind === "file" && m.path) {
          const url = await signedMaterialUrl(m.path);
          if (url) next[m.id] = url;
        }
      }
      if (alive) setUrls(next);
    })();
    return () => {
      alive = false;
    };
  }, [materials]);

  if (!materials.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="w-4 h-4" />
        {title} <span className="text-xs font-normal text-muted-foreground">({materials.length})</span>
      </div>

      <ul className="space-y-2">
        {materials.map((m) => {
          const kind = m.kind === "link" ? "link" : mediaKindOf(m);
          const url = m.kind === "link" ? m.url : urls[m.id];

          if (kind === "image" && url) {
            return (
              <li key={m.id} className="space-y-1">
                <p className="text-xs text-muted-foreground">{m.title}</p>
                <img src={url} alt={m.title} loading="lazy" className="max-h-72 rounded-md border border-border" />
              </li>
            );
          }
          if (kind === "video" && url) {
            return (
              <li key={m.id} className="space-y-1">
                <p className="text-xs text-muted-foreground">{m.title}</p>
                <video src={url} controls className="w-full max-h-72 rounded-md border border-border" />
              </li>
            );
          }
          if (kind === "audio" && url) {
            return (
              <li key={m.id} className="space-y-1">
                <p className="text-xs text-muted-foreground">{m.title}</p>
                <audio src={url} controls className="w-full" />
              </li>
            );
          }

          const Icon = kind === "link" ? ExternalLink : kind === "video" ? Film : kind === "audio" ? Music : kind === "image" ? ImageIcon : FileIcon;
          return (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-sm"
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate" title={m.title}>{m.title}</span>
              {m.kind === "file" && m.size && (
                <span className="text-xs text-muted-foreground">{formatBytes(m.size)}</span>
              )}
              <Button
                asChild={!!url}
                size="sm"
                variant="outline"
                disabled={!url}
              >
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    Otevřít
                  </a>
                ) : (
                  <span>Otevřít</span>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AssignmentMaterialsList;
