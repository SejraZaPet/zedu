import { BetaBadge } from "@/components/common/BetaBadge";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjectCatalog } from "@/hooks/useSubjectCatalog";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BookMarked,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

interface CurriculumPlanRow {
  id: string;
  subject: string;
  title: string | null;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  updated_at: string;
}

const BUCKET = "curriculum-plans";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "doc", "docx"];

export default function TeacherSubjectDetail() {
  const { subjectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { allSubjects, loading: loadingCatalog } = useSubjectCatalog({ includeArchived: true });
  const { units, loading: loadingUnits } = useTeachingUnits();

  const subject = useMemo(
    () => allSubjects.find((s) => s.id === subjectId) ?? null,
    [allSubjects, subjectId],
  );

  const [plans, setPlans] = useState<CurriculumPlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const subjectUnits = useMemo(
    () => units.filter((u) => u.subjectId === subjectId),
    [units, subjectId],
  );

  const loadPlans = async () => {
    if (!user || !subject) return;
    setLoadingPlans(true);
    const { data, error } = await supabase
      .from("teacher_curriculum_plans")
      .select("id, subject, title, content, file_url, file_name, updated_at")
      .eq("teacher_id", user.id)
      .ilike("subject", subject.name)
      .order("updated_at", { ascending: false });
    if (!error) setPlans((data as any[]) ?? []);
    setLoadingPlans(false);
  };

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, subject?.name]);

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tento ŠVP dokument?")) return;
    const { error } = await supabase.from("teacher_curriculum_plans").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "ŠVP smazáno" });
    void loadPlans();
  };

  if (loadingCatalog) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <p className="text-muted-foreground">Předmět nebyl nalezen.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/ucitel/predmety")}>
            Zpět na předměty
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-10 max-w-5xl"
        style={{ paddingTop: "calc(70px + 2.5rem)" }}
      >
        <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/predmety")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zpět na předměty
        </Button>

        <header className="flex items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: subject.color || "hsl(var(--primary))" }}
          >
            {(subject.abbreviation || subject.name.slice(0, 3)).toUpperCase()}
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold flex items-center gap-2">{subject.name} <BetaBadge context="Detail předmětu (ŠVP a Výuka)" /></h1>
            <p className="text-sm text-muted-foreground">
              Detail předmětu — ŠVP dokumenty a Výuka (třídy a skupiny)
            </p>
          </div>
          {subject.archived && <Badge variant="outline">Archivováno</Badge>}
        </header>

        {/* ───────── ŠVP ───────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-muted-foreground" /> ŠVP
            </h2>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Přidat ŠVP dokument
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            K jednomu předmětu můžete mít víc ŠVP dokumentů (např. pro různé ročníky nebo obory).
          </p>

          {loadingPlans ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Zatím žádný ŠVP dokument. Přidejte první přes tlačítko výše, nebo v sekci{" "}
              <Link to="/ucitel/svp" className="text-primary hover:underline">
                ŠVP
              </Link>
              .
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => (
                <li key={p.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">
                        {p.title?.trim() ? p.title : `ŠVP – ${subject.name}`}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Aktualizováno {new Date(p.updated_at).toLocaleDateString("cs-CZ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
                      onClick={() => void handleDelete(p.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {p.content && (
                    <p className="text-sm text-foreground/80 whitespace-pre-line line-clamp-4">
                      {p.content}
                    </p>
                  )}
                  {p.file_name && (
                    <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2 py-1.5">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{p.file_name}</span>
                      {p.file_url && (
                        <a
                          href={p.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline shrink-0 inline-flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-3 h-3" /> Otevřít
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ───────── Třídy a skupiny ───────── */}
        <section>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2 mb-1">
            <GraduationCap className="w-5 h-5 text-muted-foreground" /> Třídy a skupiny
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Klikem otevřete Výuku pro danou kombinaci předmět × třída/skupina. Vazby spravujete v{" "}
            <Link to="/ucitel/skupiny" className="text-primary hover:underline">
              Předměty a skupiny
            </Link>
            .
          </p>

          {loadingUnits ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
            </div>
          ) : subjectUnits.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Tento předmět zatím nemá žádnou třídu ani skupinu.
              </p>
              <Button variant="outline" onClick={() => navigate(`/ucitel/skupiny?subjectId=${subjectId}`)}>
                Přiřadit třídu nebo skupinu
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {subjectUnits.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => navigate(u.path)}
                  className="text-left rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-sm transition-all bg-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold text-white px-2 py-1 rounded"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.abbreviation}
                    </span>
                    {u.kind === "group" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        skupina
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {u.targetName || "—"}
                  </div>
                  {u.schoolYear && (
                    <div className="text-xs text-muted-foreground mt-1">{u.schoolYear}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />

      {addOpen && user && (
        <AddCurriculumDialog
          teacherId={user.id}
          subjectName={subject.name}
          subjectId={subject.id}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            void loadPlans();
          }}
        />
      )}
    </div>
  );
}

function AddCurriculumDialog({
  teacherId,
  subjectName,
  subjectId,
  onClose,
  onSaved,
}: {
  teacherId: string;
  subjectName: string;
  subjectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Chybí název", description: "Pojmenujte dokument (např. „ŠVP 1. ročník“).", variant: "destructive" });
      return;
    }
    if (!content.trim() && !file) {
      toast({ title: "Chybí obsah", description: "Vyplňte text nebo nahrajte soubor.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `${teacherId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw upErr;
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (error || !data) throw error ?? new Error("Nepodařilo se vytvořit odkaz na soubor.");
        fileUrl = data.signedUrl;
        fileName = file.name;
      }

      const { error } = await supabase.from("teacher_curriculum_plans").insert({
        teacher_id: teacherId,
        subject: subjectName,
        title: title.trim(),
        content: content.trim() || null,
        file_url: fileUrl,
        file_name: fileName,
      } as any);
      if (error) throw error;
      toast({ title: "ŠVP dokument přidán" });
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
          <DialogTitle>Nový ŠVP dokument – {subjectName}</DialogTitle>
          <DialogDescription>
            Pojmenujte dokument, vložte text nebo nahrajte soubor (PDF/DOC/DOCX).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="svp-title">Název dokumentu *</Label>
            <Input
              id="svp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="např. ŠVP 1. ročník"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svp-text">Text ŠVP</Label>
            <Textarea
              id="svp-text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Vložte obsah školního vzdělávacího plánu…"
            />
          </div>
          <div className="space-y-2">
            <Label>Soubor (PDF/DOC/DOCX, max 20 MB)</Label>
            {file ? (
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Zrušit
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Přidat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
