import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

const BUCKET = "curriculum-plans";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "doc", "docx"];

interface SchoolCurriculumDoc {
  id: string;
  school_id: string;
  field_of_study: string;
  title: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  updated_at: string;
}

interface Props {
  schoolId: string;
}

export default function SchoolCurriculumManager({ schoolId }: Props) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<SchoolCurriculumDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ doc: SchoolCurriculumDoc | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("school_curriculum_documents")
      .select("id, school_id, field_of_study, title, content, file_url, file_name, updated_at")
      .eq("school_id", schoolId)
      .order("field_of_study", { ascending: true })
      .order("title", { ascending: true });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      setDocs((data ?? []) as SchoolCurriculumDoc[]);
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, SchoolCurriculumDoc[]>();
    for (const d of docs) {
      const key = d.field_of_study?.trim() || "Bez oboru";
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "cs"));
  }, [docs]);

  const handleDelete = async (doc: SchoolCurriculumDoc) => {
    if (!confirm(`Opravdu smazat „${doc.title}“?`)) return;
    const { error } = await supabase.from("school_curriculum_documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dokument smazán" });
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Celoškolní ŠVP</CardTitle>
          <CardDescription>
            Referenční dokumenty školního vzdělávacího programu podle oborů. Učitelé školy si je
            mohou zobrazit, upravovat je může jen vedení školy.
          </CardDescription>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setEditing({ doc: null })}>
          <Plus className="w-4 h-4" /> Přidat dokument
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítám…
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím nemáte nahraný žádný celoškolní ŠVP. Přidejte první dokument podle oboru.
          </p>
        ) : (
          groups.map(([field, items]) => (
            <section key={field} className="space-y-3">
              <h3 className="font-semibold">{field}</h3>
              <div className="space-y-3">
                {items.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{doc.title || "Bez názvu"}</p>
                        <p className="text-xs text-muted-foreground">
                          Aktualizováno {new Date(doc.updated_at).toLocaleDateString("cs-CZ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing({ doc })}>
                          <Pencil className="w-4 h-4" /> Upravit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {doc.content && (
                      <p className="text-sm whitespace-pre-wrap line-clamp-4">{doc.content}</p>
                    )}
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        {doc.file_name ?? "Soubor"}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </CardContent>

      {editing && (
        <SchoolCurriculumDialog
          schoolId={schoolId}
          userId={user?.id ?? null}
          doc={editing.doc}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </Card>
  );
}

interface DialogProps {
  schoolId: string;
  userId: string | null;
  doc: SchoolCurriculumDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

function SchoolCurriculumDialog({ schoolId, userId, doc, onClose, onSaved }: DialogProps) {
  const [field, setField] = useState(doc?.field_of_study ?? "");
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [fileName, setFileName] = useState<string | null>(doc?.file_name ?? null);
  const [fileUrl, setFileUrl] = useState<string | null>(doc?.file_url ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast({ title: "Soubor zamítnut", description: "Soubor je větší než 20 MB.", variant: "destructive" });
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.includes(ext)) {
      toast({ title: "Soubor zamítnut", description: "Povolené formáty: PDF, DOC, DOCX.", variant: "destructive" });
      return;
    }
    setFile(f);
    setFileName(f.name);
  };

  const uploadFileIfAny = async (): Promise<{ url: string | null; name: string | null }> => {
    if (!file) return { url: fileUrl, name: fileName };
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `school/${schoolId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) throw upErr;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (error || !data) throw error ?? new Error("Nepodařilo se vytvořit odkaz na soubor.");
    return { url: data.signedUrl, name: file.name };
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Chybí název", description: "Zadejte název dokumentu.", variant: "destructive" });
      return;
    }
    if (!content.trim() && !file && !fileUrl) {
      toast({ title: "Chybí obsah", description: "Vyplňte text nebo nahrajte soubor.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { url, name } = await uploadFileIfAny();
      const fields = {
        field_of_study: field.trim(),
        title: title.trim(),
        content: content.trim() || null,
        file_url: url,
        file_name: name,
      };
      const { error } = doc
        ? await supabase.from("school_curriculum_documents").update(fields).eq("id", doc.id)
        : await supabase
            .from("school_curriculum_documents")
            .insert({ school_id: schoolId, uploaded_by: userId, ...fields });
      if (error) throw error;
      toast({ title: "Uloženo" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doc ? "Upravit celoškolní ŠVP" : "Nový celoškolní ŠVP"}</DialogTitle>
          <DialogDescription>
            Vložte text nebo nahrajte soubor (PDF/DOC/DOCX, max 20 MB). Můžete použít obojí.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scd-field">Obor</Label>
            <Input
              id="scd-field"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Např. Kuchař – číšník (65-51-H/01)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scd-title">Název dokumentu</Label>
            <Input
              id="scd-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. ŠVP 2026/2027"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scd-content">Text (nepovinné)</Label>
            <Textarea
              id="scd-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Vložte text celoškolního ŠVP…"
            />
          </div>
          <div className="space-y-2">
            <Label>Soubor (PDF/DOC/DOCX, max 20 MB)</Label>
            {fileName ? (
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{fileName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setFileName(null);
                    setFileUrl(null);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Zavřít
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy} className="gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
