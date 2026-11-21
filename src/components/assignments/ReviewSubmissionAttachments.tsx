import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getStudentAttachmentSignedUrl } from "@/lib/portfolio";
import {
  attachmentsForSubmission,
  formatAttachmentSize,
  type ReviewAttachment,
} from "@/lib/review-attachments";

interface Props {
  assignmentId: string;
  studentId: string;
  attemptId: string;
  groupId?: string | null;
}

/** Poznámka a přílohy žáka v hodnoticím panelu „Ke kontrole“ (jen čtení, existující oprávnění). */
const ReviewSubmissionAttachments = ({ assignmentId, studentId, attemptId, groupId }: Props) => {
  const [files, setFiles] = useState<ReviewAttachment[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setNote(null);
    (async () => {
      let members: string[] = [];
      if (groupId) {
        const { data } = await supabase
          .from("assignment_group_members")
          .select("student_id")
          .eq("group_id", groupId);
        members = ((data ?? []) as any[]).map((m) => m.student_id);
      }
      const [{ data: att }, { data: at }] = await Promise.all([
        supabase
          .from("assignment_attachments" as any)
          .select("id, student_id, file_name, file_path, file_size, uploaded_at")
          .eq("assignment_id", assignmentId)
          .order("uploaded_at", { ascending: true }),
        supabase.from("assignment_attempts").select("submission_note").eq("id", attemptId).maybeSingle(),
      ]);
      if (cancelled) return;
      setFiles(attachmentsForSubmission((att ?? []) as unknown as ReviewAttachment[], studentId, members));
      setNote(((at as any)?.submission_note as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, studentId, attemptId, groupId]);

  const open = async (f: ReviewAttachment) => {
    setOpening(f.id);
    try {
      const url = await getStudentAttachmentSignedUrl(f.file_path, { expiresIn: 300 });
      if (!url) throw new Error("Odkaz na soubor se nepodařilo získat. Zkuste to prosím znovu.");
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: "Soubor nelze otevřít", description: e.message, variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold">Poznámka žáka</h3>
        {note ? (
          <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 text-sm">{note}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Bez poznámky.</p>
        )}
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold">Přílohy</h3>
        {files === null ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné přílohy.</p>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={f.file_name}>{f.file_name}</span>
                <span className="text-xs text-muted-foreground">{formatAttachmentSize(f.file_size)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => open(f)}
                  disabled={opening === f.id}
                  aria-label={`Otevřít ${f.file_name}`}
                >
                  {opening === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span className="ml-1">Otevřít</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReviewSubmissionAttachments;
