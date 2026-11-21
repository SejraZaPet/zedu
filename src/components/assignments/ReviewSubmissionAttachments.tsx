import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getStudentAttachmentSignedUrl } from "@/lib/portfolio";
import { formatAttachmentSize, type ReviewAttachment } from "@/lib/review-attachments";

interface Props {
  files: ReviewAttachment[];
  note?: string | null;
}

/** Poznámka a přílohy žáka v hodnoticím panelu „Ke kontrole“ (jen čtení, existující oprávnění). */
const ReviewSubmissionAttachments = ({ files, note }: Props) => {
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (file: ReviewAttachment) => {
    setOpening(file.id);
    try {
      const url = await getStudentAttachmentSignedUrl(file.file_path, { expiresIn: 300 });
      if (!url) throw new Error("Odkaz na soubor se nepodařilo získat. Zkuste to prosím znovu.");
      window.open(url, "_blank", "noopener");
    } catch (error: any) {
      toast({ title: "Soubor nelze otevřít", description: error.message, variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold">Poznámka žáka</h3>
        {note ? (
          <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-sm">{note}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Bez poznámky.</p>
        )}
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold">Přílohy</h3>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné přílohy</p>
        ) : (
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={file.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border p-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={file.file_name}>{file.file_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatAttachmentSize(file.file_size)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 shrink-0"
                  onClick={() => open(file)}
                  disabled={opening === file.id}
                  aria-label={`Otevřít ${file.file_name}`}
                >
                  {opening === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
