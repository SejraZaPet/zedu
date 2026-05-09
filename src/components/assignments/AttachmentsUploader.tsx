import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileIcon, X, Loader2, Paperclip } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

interface Props {
  assignmentId: string;
  studentId: string;
  disabled?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} kB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const AttachmentsUploader = ({ assignmentId, studentId, disabled }: Props) => {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [assignmentId, studentId]);

  const load = async () => {
    const { data } = await supabase
      .from("assignment_attachments" as any)
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId)
      .order("uploaded_at", { ascending: false });
    setFiles((data as any) || []);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_BYTES) return "Soubor je větší než 10 MB.";
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.includes(file.type)) {
      return "Nepovolený typ souboru. Povolené: PDF, JPG, PNG, DOCX.";
    }
    return null;
  };

  const handleUpload = async (file: File) => {
    const err = validateFile(file);
    if (err) {
      toast({ title: "Soubor zamítnut", description: err, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${assignmentId}/${studentId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("student-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("assignment_attachments" as any).insert({
        assignment_id: assignmentId,
        student_id: studentId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
      } as any);
      if (insErr) {
        await supabase.storage.from("student-attachments").remove([path]);
        throw insErr;
      }
      toast({ title: "Příloha nahrána" });
      load();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach(handleUpload);
  };

  const handleDelete = async (att: Attachment) => {
    await supabase.storage.from("student-attachments").remove([att.file_path]);
    await supabase.from("assignment_attachments" as any).delete().eq("id", att.id);
    setFiles((prev) => prev.filter((f) => f.id !== att.id));
    toast({ title: "Příloha smazána" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Paperclip className="w-4 h-4" />
        Přílohy <span className="text-xs text-muted-foreground font-normal">({files.length})</span>
      </div>

      {!disabled && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
          }`}
        >
          <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground mb-2">
            Přetáhni soubor sem nebo klikni níže. Max 10 MB · PDF, JPG, PNG, DOCX
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Vybrat soubor
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            multiple
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 p-2 rounded-md border border-border bg-background text-sm"
            >
              <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate" title={f.file_name}>{f.file_name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</span>
              {!disabled && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleDelete(f)}
                  aria-label={`Smazat ${f.file_name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AttachmentsUploader;
