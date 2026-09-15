import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award, Trophy, FileText, Lightbulb, Paperclip, ChevronLeft, ChevronRight,
  ExternalLink, NotebookPen, Video,
} from "lucide-react";
import {
  PortfolioItem, TYPE_LABEL, getAttachmentSignedUrl, getStudentAttachmentSignedUrl,
} from "@/lib/portfolio";
import { cn } from "@/lib/utils";

interface Props {
  items: PortfolioItem[];
  canDelete?: boolean;
  onItemDeleted?: (id: string) => void;
  initialSubject?: string;
}

const ICONS: Record<string, any> = {
  worksheet_result: FileText,
  project: Paperclip,
  reflection: Lightbulb,
  upload: Paperclip,
  achievement: Trophy,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function PortfolioBookView({ items, initialSubject }: Props) {
  const navigate = useNavigate();
  const filtered = useMemo(
    () => (initialSubject ? items.filter((i) => (i.subject ?? "") === initialSubject) : items),
    [items, initialSubject],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [initialSubject, items]);

  const active = filtered[index] ?? null;

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setSignedUrl(null);
    if (!active?.attachment_url) return;
    let cancelled = false;
    getAttachmentSignedUrl(active.attachment_url).then((u) => {
      if (!cancelled) setSignedUrl(u);
    });
    return () => { cancelled = true; };
  }, [active?.attachment_url]);

  useEffect(() => {
    setFileUrls({});
    if (!active?.files || active.files.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(active.files!.map(async (f) => {
        let url = await getStudentAttachmentSignedUrl(f.file_url);
        if (!url) url = await getAttachmentSignedUrl(f.file_url);
        return [f.id, url] as const;
      }));
      if (cancelled) return;
      const map: Record<string, string | null> = {};
      for (const [id, u] of entries) map[id] = u;
      setFileUrls(map);
    })();
    return () => { cancelled = true; };
  }, [active?.files]);

  if (filtered.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        Zatím tu nic není.
      </CardContent></Card>
    );
  }

  const notebookId = (active?.content_json as any)?.notebook_id as string | undefined;
  const ActiveIcon = active ? (ICONS[active.type] || Award) : Award;
  const isImage = !!signedUrl && /\.(png|jpe?g|gif|webp|svg)$/i.test(active?.attachment_url || "");

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <aside className="space-y-1.5 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
        {filtered.map((item, i) => {
          const Icon = ICONS[item.type] || Award;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              className={cn(
                "w-full rounded-lg border p-2 text-left transition-colors",
                i === index ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <span className="flex items-start gap-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("cs-CZ")}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      <Card className="min-h-[320px]">
        <CardContent className="space-y-4 py-5">
          {active && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ActiveIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{active.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABEL[active.type] || active.type}
                      </Badge>
                      {active.subject && (
                        <Badge variant="secondary" className="text-[10px]">{active.subject}</Badge>
                      )}
                      {notebookId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-[11px]"
                          onClick={() => navigate(`/student/sesit?otevrit=${notebookId}`)}
                        >
                          <NotebookPen className="h-3 w-3" /> Ze sešitu
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(active.created_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon" variant="ghost" aria-label="Předchozí"
                    disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {index + 1}/{filtered.length}
                  </span>
                  <Button
                    size="icon" variant="ghost" aria-label="Další"
                    disabled={index >= filtered.length - 1}
                    onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {active.description && (
                <p className="whitespace-pre-wrap text-sm">{active.description}</p>
              )}

              {active.type === "worksheet_result" && active.content_json?.score != null && (
                <p className="text-sm">
                  Skóre:{" "}
                  <span className="font-semibold">
                    {active.content_json.score}
                    {active.content_json.max_score ? ` / ${active.content_json.max_score}` : ""}
                  </span>
                </p>
              )}

              {isImage && (
                <img
                  src={signedUrl!}
                  alt={active.title}
                  className="max-h-80 w-auto rounded-lg border border-border"
                />
              )}
              {signedUrl && !isImage && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Otevřít přílohu
                </a>
              )}
              {active.video_url && (
                <a
                  href={active.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Video className="h-3.5 w-3.5" /> Otevřít video
                </a>
              )}
              {active.files && active.files.length > 0 && (
                <ul className="space-y-1">
                  {active.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.file_name}</span>
                      {fileUrls[f.id] && (
                        <a
                          href={fileUrls[f.id]!}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Otevřít
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
