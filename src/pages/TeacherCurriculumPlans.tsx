import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySubjects } from "@/hooks/useMySubjects";
import SubjectPicker from "@/components/subjects/SubjectPicker";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  BookMarked,
  Download,
  FileText,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
} from "lucide-react";
import CurriculumTopicsSection from "@/components/teacher/CurriculumTopicsSection";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";
import {
  buildCurriculumBlocks,
  curriculumBlocksToText,
  legacyContentToBlocks,
} from "@/lib/curriculum-template";
import { downloadCurriculumPdf } from "@/lib/curriculum-pdf-export";

interface CurriculumPlan {
  id: string;
  teacher_id: string;
  subject: string;
  title: string;
  content: string | null;
  content_blocks: Block[] | null;
  file_url: string | null;
  file_name: string | null;
  updated_at: string;
}

const BUCKET = "curriculum-plans";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "doc", "docx"];

/** Bloky plánu – z content_blocks, jinak fallback ze starého textu. */
function planBlocks(plan: CurriculumPlan | null): Block[] {
  if (!plan) return [];
  const raw = plan.content_blocks;
  if (Array.isArray(raw) && raw.length > 0) return raw as Block[];
  return legacyContentToBlocks(plan.content);
}


export default function TeacherCurriculumPlans() {
  const { user } = useAuth();
  const { subjects, loading: subjectsLoading, refetch: refetchSubjects } = useMySubjects();
  const [plans, setPlans] = useState<CurriculumPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ subject: string; plan: CurriculumPlan | null } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_curriculum_plans")
      .select("*")
      .eq("teacher_id", user.id);
    if (!error) setPlans((data as CurriculumPlan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const plansBySubject = useMemo(() => {
    const map = new Map<string, CurriculumPlan[]>();
    for (const p of plans) {
      const k = p.subject.toLowerCase();
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", "cs") ||
        a.updated_at.localeCompare(b.updated_at),
      );
    }
    return map;
  }, [plans]);


  // Předměty učitele (vlastní + použité u jeho tříd) + ty, ke kterým už ŠVP existuje
  const subjectRows = useMemo(() => {
    const seen = new Set<string>();
    const rows: { label: string }[] = [];
    for (const s of subjects) {
      const k = s.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ label: s.name });
    }
    for (const p of plans) {
      const k = p.subject.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ label: p.subject });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, "cs"));
  }, [subjects, plans]);

  const picker = (
    <SubjectPicker
      value={null}
      onChange={({ name }) => {
        void refetchSubjects();
        setEditing({ subject: name.trim(), plan: null });
      }}
      placeholder="Vybrat nebo vytvořit předmět"
      className="max-w-sm"
    />
  );


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />
      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-primary" />
            Školní vzdělávací plán (ŠVP)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ukládejte si k jednotlivým předmětům svůj ŠVP – jako vložený text nebo nahraný soubor (PDF/DOCX).
            Nabízíme jen předměty, které sami používáte. Vidíte ho pouze vy.
          </p>
        </div>

        {!loading && !subjectsLoading && subjectRows.length > 0 && (
          <div className="mb-4">{picker}</div>
        )}



        {loading || subjectsLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Načítání…
          </div>
        ) : subjectRows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Zatím nemáte žádný vlastní předmět. Vyberte nebo si založte předmět – pak se tu
              objeví i pro ŠVP. Předměty spravujete také v sekci{" "}
              <Link to="/ucitel/skupiny" className="text-primary hover:underline">
                Předměty a skupiny
              </Link>
              .
            </p>
            <div className="flex justify-center">{picker}</div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">

            {subjectRows.map((row) => {
              const subjectPlans = plansBySubject.get(row.label.toLowerCase()) ?? [];
              return (
                <article
                  key={row.label}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
                >
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{row.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {subjectPlans.length === 0
                          ? "Zatím bez ŠVP"
                          : `${subjectPlans.length} ŠVP`}
                      </p>
                    </div>
                  </header>

                  {subjectPlans.map((plan) => (
                    <div key={plan.id} className="rounded-lg border border-border/70 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {plan.title || row.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Aktualizováno {new Date(plan.updated_at).toLocaleDateString("cs-CZ")}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            title="Stáhnout PDF"
                            onClick={() =>
                              void downloadCurriculumPdf({
                                title: plan.title || row.label,
                                subject: row.label,
                                blocks: planBlocks(plan),
                              }).catch((e: any) =>
                                toast({
                                  title: "Export selhal",
                                  description: e?.message ?? String(e),
                                  variant: "destructive",
                                }),
                              )
                            }
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setEditing({ subject: row.label, plan })}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Upravit
                          </Button>
                        </div>
                      </div>


                      {plan.content && (
                        <p className="text-sm text-foreground/80 whitespace-pre-line line-clamp-4">
                          {plan.content}
                        </p>
                      )}
                      {plan.file_name && (
                        <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2 py-1.5">
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate flex-1">{plan.file_name}</span>
                          {plan.file_url && (
                            <a
                              href={plan.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline shrink-0 inline-flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-3 h-3" /> Otevřít
                            </a>
                          )}
                        </div>
                      )}

                      {user && (
                        <CurriculumTopicsSection
                          planId={plan.id}
                          planContent={plan.content}
                          teacherId={user.id}
                          subject={row.label}
                        />
                      )}
                    </div>
                  ))}

                  <div className="pt-1">
                    <Button
                      variant={subjectPlans.length ? "outline" : "default"}
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => setEditing({ subject: row.label, plan: null })}
                    >
                      <Plus className="w-4 h-4" /> Přidat ŠVP
                    </Button>
                  </div>
                </article>
              );
            })}

          </div>
        )}
      </main>
      <SiteFooter />

      {editing && (
        <EditCurriculumDialog
          teacherId={user!.id}
          subject={editing.subject}
          plan={editing.plan}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface DialogProps {
  teacherId: string;
  subject: string;
  plan: CurriculumPlan | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditCurriculumDialog({ teacherId, subject, plan, onClose, onSaved }: DialogProps) {
  const [title, setTitle] = useState(plan?.title?.trim() || subject);
  const [blocks, setBlocks] = useState<Block[]>(() => planBlocks(plan));

  const [fileName, setFileName] = useState<string | null>(plan?.file_name ?? null);
  const [fileUrl, setFileUrl] = useState<string | null>(plan?.file_url ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const validateFile = (f: File): string | null => {
    if (f.size > MAX_BYTES) return "Soubor je větší než 20 MB.";
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.includes(ext)) return "Povolené formáty: PDF, DOC, DOCX.";
    return null;
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      toast({ title: "Soubor zamítnut", description: err, variant: "destructive" });
      return;
    }
    setFile(f);
    setFileName(f.name);
  };

  const uploadFileIfAny = async (): Promise<{ url: string | null; name: string | null }> => {
    if (!file) return { url: fileUrl, name: fileName };
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${teacherId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) throw upErr;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // 5 years
    if (error || !data) throw error ?? new Error("Nepodařilo se vytvořit odkaz na soubor.");
    return { url: data.signedUrl, name: file.name };
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Chybí název",
        description: "Zadejte název ŠVP.",
        variant: "destructive",
      });
      return;
    }
    const summary = curriculumBlocksToText(blocks);
    if (!summary.trim() && !file && !fileUrl) {
      toast({
        title: "Chybí obsah",
        description: "Vyplňte alespoň jeden blok nebo nahrajte soubor.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { url, name } = await uploadFileIfAny();
      const fields = {
        title: title.trim(),
        // starý textový sloupec držíme jako souhrn pro zpětnou kompatibilitu
        content: summary || null,
        content_blocks: blocks.length ? (blocks as unknown as any) : null,
        file_url: url,
        file_name: name,
      };
      const { error } = plan
        ? await supabase.from("teacher_curriculum_plans").update(fields).eq("id", plan.id)
        : await supabase
            .from("teacher_curriculum_plans")
            .insert({ teacher_id: teacherId, subject, ...fields });

      if (error) throw error;
      toast({ title: "ŠVP uloženo" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };


  const handleDelete = async () => {
    if (!plan) return;
    if (!confirm("Opravdu smazat ŠVP pro tento předmět?")) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("teacher_curriculum_plans")
        .delete()
        .eq("id", plan.id);
      if (error) throw error;
      toast({ title: "ŠVP smazáno" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFileName(null);
    setFileUrl(null);
  };

  const handlePdf = async () => {
    try {
      await downloadCurriculumPdf({ title: title.trim() || subject, subject, blocks });
    } catch (e: any) {
      toast({ title: "Export selhal", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ŠVP – {subject}</DialogTitle>
          <DialogDescription>
            Skládejte ŠVP z bloků (nadpisy, odstavce, tabulky). Bloky lze přetahovat, skrývat
            i mazat. Volitelně můžete nahrát i původní soubor (PDF/DOC/DOCX).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="svp-title">Název ŠVP</Label>
            <Input
              id="svp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. ŠVP – 1. ročník"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Obsah ŠVP</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handlePdf()}
                >
                  <Download className="w-4 h-4" /> Stáhnout PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (
                      blocks.length > 0 &&
                      !confirm("Obsah není prázdný. Přepsat ho strukturovanou šablonou ŠVP?")
                    )
                      return;
                    setBlocks(buildCurriculumBlocks());
                  }}
                >
                  <LayoutTemplate className="w-4 h-4" /> Použít šablonu
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border p-2">
              <BlockEditor blocks={blocks} onChange={setBlocks} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Soubor (PDF/DOC/DOCX, max 20 MB)</Label>
            {fileName ? (
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{fileName}</span>
                <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div>
            {plan && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={busy}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" /> Smazat
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Zavřít
            </Button>
            <Button type="button" onClick={handleSave} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Uložit
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
