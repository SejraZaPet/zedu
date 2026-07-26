import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getStudentAttachmentSignedUrl } from "@/lib/portfolio";
import { Eye, ExternalLink, FileText, Loader2, FolderOpen } from "lucide-react";

interface Props {
  assignmentId: string;
  studentId: string;
  studentName?: string;
  assignmentTitle?: string;
  triggerVariant?: "icon" | "button";
}

interface AttachmentRow {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
}

interface AttemptRow {
  id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  answers: Record<string, any>;
}

export default function AttemptQuickPreviewDialog({
  assignmentId, studentId, studentName, assignmentTitle, triggerVariant = "icon",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [attachments, setAttachments] = useState<Array<AttachmentRow & { url?: string | null }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [attRes, filesRes] = await Promise.all([
        supabase
          .from("assignment_attempts" as any)
          .select("id, status, score, max_score, submitted_at, answers")
          .eq("assignment_id", assignmentId)
          .eq("student_id", studentId)
          .order("attempt_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("assignment_attachments" as any)
          .select("id, file_name, file_path, file_size")
          .eq("assignment_id", assignmentId)
          .eq("student_id", studentId),
      ]);
      if (cancelled) return;
      setAttempt((attRes.data as any) ?? null);
      const rows = (filesRes.data as any[]) ?? [];
      const withUrls = await Promise.all(rows.map(async (r) => ({
        ...r,
        url: await getStudentAttachmentSignedUrl(r.file_path),
      })));
      if (!cancelled) setAttachments(withUrls);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, assignmentId, studentId]);

  const answerCount = attempt ? Object.keys(attempt.answers || {}).length : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerVariant === "icon" ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(true)}
          aria-label="Rychlý náhled"
          title="Rychlý náhled"
        >
          <Eye className="w-4 h-4" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Eye className="w-4 h-4 mr-1.5" /> Náhled
        </Button>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Náhled odevzdání
          </DialogTitle>
          {(studentName || assignmentTitle) && (
            <p className="text-xs text-muted-foreground">
              {studentName}{studentName && assignmentTitle ? " · " : ""}{assignmentTitle}
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !attempt ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Žádný pokus.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={attempt.status === "submitted" ? "default" : "secondary"}>
                {attempt.status === "submitted" ? "Odevzdáno" : attempt.status}
              </Badge>
              {attempt.score != null && (
                <Badge variant="outline">
                  Skóre: {attempt.score}{attempt.max_score != null ? ` / ${attempt.max_score}` : ""}
                </Badge>
              )}
              {attempt.submitted_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(attempt.submitted_at).toLocaleString("cs-CZ")}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {answerCount} {answerCount === 1 ? "odpověď" : "odpovědí"}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Přílohy</h4>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné přílohy.</p>
              ) : (
                <ul className="space-y-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{a.file_name}</span>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          <ExternalLink className="w-3 h-3" /> Otevřít
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" asChild>
            <Link to={`/portfolio/${studentId}`}>
              <FolderOpen className="w-4 h-4 mr-1.5" /> Zobrazit v portfoliu žáka
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
