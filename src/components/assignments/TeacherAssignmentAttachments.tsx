import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Paperclip, Download, Loader2, FileIcon, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Attachment {
  id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
  student_name?: string;
}

interface Props {
  assignmentId: string;
}

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} kB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const TeacherAssignmentAttachments = ({ assignmentId }: Props) => {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadCount();
  }, [assignmentId]);

  const loadCount = async () => {
    const { count: c } = await supabase
      .from("assignment_attachments" as any)
      .select("*", { count: "exact", head: true })
      .eq("assignment_id", assignmentId);
    setCount(c ?? 0);
  };

  const loadFiles = async () => {
    const { data } = await supabase
      .from("assignment_attachments" as any)
      .select("id, student_id, file_name, file_path, file_size, uploaded_at")
      .eq("assignment_id", assignmentId)
      .order("uploaded_at", { ascending: false });
    const list = (data as any[]) || [];
    if (list.length) {
      const ids = Array.from(new Set(list.map((f) => f.student_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      const map = new Map((profs || []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
      list.forEach((f) => { f.student_name = map.get(f.student_id) || "Žák"; });
    }
    setFiles(list);
  };

  const handleToggle = async (val: boolean) => {
    setOpen(val);
    if (val && files.length === 0 && count && count > 0) {
      await loadFiles();
    }
  };

  const handleDownload = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const { data, error } = await supabase.storage
        .from("student-attachments")
        .createSignedUrl(att.file_path, 60, { download: att.file_name });
      if (error || !data?.signedUrl) throw error || new Error("URL se nepodařilo získat");
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast({ title: "Chyba stahování", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  if (count === null) return null;

  return (
    <Collapsible open={open} onOpenChange={handleToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={count === 0}>
          <Paperclip className="w-3 h-3" />
          {count} {count === 1 ? "příloha" : count >= 2 && count <= 4 ? "přílohy" : "příloh"}
          {count > 0 && <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {files.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">Načítám…</div>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-background text-xs">
                <FileIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium" title={f.file_name}>{f.file_name}</p>
                  <p className="text-muted-foreground">{f.student_name} · {formatBytes(f.file_size)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleDownload(f)}
                  disabled={downloading === f.id}
                  aria-label={`Stáhnout ${f.file_name}`}
                >
                  {downloading === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TeacherAssignmentAttachments;
