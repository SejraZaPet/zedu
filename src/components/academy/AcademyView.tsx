import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, GraduationCap, CheckCircle2, Circle, Award, Play, Download, FileBadge2, Share2, SlidersHorizontal, PartyPopper,
} from "lucide-react";

type AudienceScope = "teacher" | "student" | "parent";

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_accredited: boolean;
  accreditation_number: string | null;
  audience: "teacher" | "student" | "both";
  issues_certificate: boolean;
  requires_evidence: boolean;
  price: number | null;
  category: string | null;
  revenue_type: string | null;

  sort_order: number;
  moduleCount?: number;
  enrollment?: { id: string; completed_at: string | null } | null;
  completedCount?: number;
}

interface EvidenceSubmission {
  id: string;
  enrollment_id: string;
  description: string;
  file_url: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_comment: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

interface Module {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  sort_order: number;
}

interface CertificateRow {
  id: string;
  certificate_number: string;
  issued_at: string;
  pdf_url: string | null;
  enrollment_id: string;
  course_title: string;
}

const renderContent = (content: string) => {
  const lines = content.split("\n");
  const out: JSX.Element[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(<p key={out.length} className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{para.join("\n").trim()}</p>);
      para = [];
    }
  };
  lines.forEach((l) => {
    if (l.startsWith("## ")) { flush(); out.push(<h3 key={out.length} className="font-heading text-lg font-semibold mt-4 mb-1">{l.slice(3)}</h3>); }
    else if (l.startsWith("# ")) { flush(); out.push(<h2 key={out.length} className="font-heading text-xl font-semibold mt-4 mb-1">{l.slice(2)}</h2>); }
    else para.push(l);
  });
  flush();
  return <div className="space-y-2">{out}</div>;
};

const statusMeta = (status: EvidenceSubmission["status"]) => {
  if (status === "approved") return { label: "Schváleno 🎉", cls: "bg-primary/10 text-primary border-primary/30" };
  if (status === "rejected") return { label: "Zamítnuto", cls: "bg-destructive/10 text-destructive border-destructive/30" };
  return { label: "Čeká na posouzení", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" };
};

interface EvidencePanelProps {
  evidence: EvidenceSubmission | null;
  evidenceDesc: string;
  setEvidenceDesc: (v: string) => void;
  evidenceFile: File | null;
  setEvidenceFile: (f: File | null) => void;
  submitting: boolean;
  onSubmit: () => void;
}

const EvidencePanel = ({ evidence, evidenceDesc, setEvidenceDesc, evidenceFile, setEvidenceFile, submitting, onSubmit }: EvidencePanelProps) => {
  const showForm = !evidence || evidence.status === "rejected";
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileBadge2 className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold">Odevzdat důkaz z praxe</h3>
        {evidence && (
          <Badge variant="outline" className={statusMeta(evidence.status).cls}>{statusMeta(evidence.status).label}</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Certifikát tohoto kurzu se vydává až po ověření, že jste poznatky uplatnil/a ve své výuce. Popište stručně, jak/kde a případně přiložte fotku nebo dokument z hodiny.
      </p>

      {evidence && evidence.status !== "rejected" && (
        <div className="text-sm space-y-2">
          <div className="p-3 rounded-lg bg-muted/50 whitespace-pre-wrap">{evidence.description}</div>
          {evidence.status === "approved" && (
            <p className="text-sm text-primary">Certifikát byl vydán – najdete ho v záložce Moje certifikáty.</p>
          )}
        </div>
      )}

      {evidence && evidence.status === "rejected" && evidence.reviewer_comment && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
          <div className="font-medium mb-1">Komentář recenzenta:</div>
          <div className="whitespace-pre-wrap">{evidence.reviewer_comment}</div>
        </div>
      )}

      {showForm && (
        <div className="space-y-2">
          <div>
            <Label htmlFor="ev-desc">Popis uplatnění v praxi</Label>
            <Textarea
              id="ev-desc"
              rows={5}
              value={evidenceDesc}
              onChange={(e) => setEvidenceDesc(e.target.value)}
              placeholder="Např. Použil/a jsem metodu XY v 6. ročníku při hodině literatury… žáci pracovali ve skupinách…"
            />
          </div>
          <div>
            <Label htmlFor="ev-file">Volitelná příloha (foto / PDF / DOCX)</Label>
            <Input
              id="ev-file"
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
            />
            {evidenceFile && <p className="text-xs text-muted-foreground mt-1">{evidenceFile.name}</p>}
          </div>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Odesílám…" : evidence?.status === "rejected" ? "Odeslat znovu" : "Odeslat důkaz"}
          </Button>
        </div>
      )}
    </div>
  );
};



interface AcademyViewProps {
  audience: AudienceScope;
  title?: string;
  subtitle?: string;
}

const AcademyView = ({ audience, title, subtitle }: AcademyViewProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrollmentCompletedAt, setEnrollmentCompletedAt] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [certLoading, setCertLoading] = useState(false);

  // Pathways (skládatelné kvalifikace)
  interface PathwayItem {
    id: string;
    title: string;
    description: string | null;
    total: number;
    completed: number;
    certificate_number: string | null;
  }
  const [pathways, setPathways] = useState<PathwayItem[]>([]);
  const [pathwaysLoading, setPathwaysLoading] = useState(false);


  // Evidence submission for current course
  const [evidence, setEvidence] = useState<EvidenceSubmission | null>(null);
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);

  const audienceValues = audience === "teacher" ? ["teacher", "both"] : audience === "parent" ? ["parent", "both"] : ["student", "both"];

  // --- Filtry kurzů ---
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCert, setFilterCert] = useState<string>("all");
  const [filterAccredited, setFilterAccredited] = useState<string>("all");
  const [filterPrice, setFilterPrice] = useState<string>("all");
  const [filterAudience, setFilterAudience] = useState<string>("all");

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category).filter((v): v is string => !!v && v.trim() !== ""))).sort((a, b) => a.localeCompare(b, "cs")),
    [courses],
  );
  const filteredCourses = useMemo(
    () => courses.filter((c) => {
      if (filterCategory !== "all" && (c.category || "") !== filterCategory) return false;
      if (filterCert !== "all" && String(!!c.issues_certificate) !== filterCert) return false;
      if (filterAccredited !== "all" && String(!!c.is_accredited) !== filterAccredited) return false;
      if (filterAudience !== "all" && c.audience !== filterAudience) return false;
      const isPaid = !!c.price && Number(c.price) > 0;
      if (filterPrice === "free" && isPaid) return false;
      if (filterPrice === "paid" && !isPaid) return false;
      return true;
    }),
    [courses, filterCategory, filterCert, filterAccredited, filterPrice, filterAudience],
  );
  const filtersActive = filterCategory !== "all" || filterCert !== "all" || filterAccredited !== "all" || filterPrice !== "all" || filterAudience !== "all";
  const resetFilters = () => { setFilterCategory("all"); setFilterCert("all"); setFilterAccredited("all"); setFilterPrice("all"); setFilterAudience("all"); };




  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const { data: courseRows } = await supabase
      .from("academy_courses")
      .select("*")
      .eq("is_published", true)
      .in("audience", audienceValues)
      .order("sort_order", { ascending: true });

    if (!courseRows) { setCourses([]); setLoading(false); return; }

    const courseIds = courseRows.map((c: any) => c.id);
    const [{ data: modCounts }, { data: enrolls }] = await Promise.all([
      supabase.from("academy_modules").select("id, course_id").in("course_id", courseIds),
      user
        ? supabase.from("academy_enrollments").select("id, course_id, completed_at").eq("teacher_id", user.id).in("course_id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const enrollmentIds = (enrolls || []).map((e: any) => e.id);
    const { data: completions } = enrollmentIds.length
      ? await supabase.from("academy_module_completions").select("enrollment_id, module_id").in("enrollment_id", enrollmentIds)
      : { data: [] as any[] };

    const modByCourse = new Map<string, number>();
    (modCounts || []).forEach((m: any) => modByCourse.set(m.course_id, (modByCourse.get(m.course_id) || 0) + 1));
    const enrollByCourse = new Map<string, { id: string; completed_at: string | null }>();
    (enrolls || []).forEach((e: any) => enrollByCourse.set(e.course_id, { id: e.id, completed_at: e.completed_at }));
    const completionsByEnrollment = new Map<string, number>();
    (completions || []).forEach((c: any) => completionsByEnrollment.set(c.enrollment_id, (completionsByEnrollment.get(c.enrollment_id) || 0) + 1));

    setCourses(
      (courseRows as any[]).map((c) => {
        const enr = enrollByCourse.get(c.id) || null;
        return { ...c, moduleCount: modByCourse.get(c.id) || 0, enrollment: enr, completedCount: enr ? completionsByEnrollment.get(enr.id) || 0 : 0 };
      }) as Course[],
    );
    setLoading(false);
  }, [user, audience]);

  const fetchCertificates = useCallback(async () => {
    if (!user) return;
    setCertLoading(true);
    const { data } = await supabase
      .from("academy_certificates")
      .select("id, certificate_number, issued_at, pdf_url, enrollment_id, academy_enrollments!inner(teacher_id, course_id, academy_courses(title, audience))")
      .eq("academy_enrollments.teacher_id", user.id)
      .order("issued_at", { ascending: false });
    const mapped: CertificateRow[] = (data || [])
      .filter((r: any) => audienceValues.includes(r.academy_enrollments?.academy_courses?.audience))
      .map((r: any) => ({
        id: r.id,
        certificate_number: r.certificate_number,
        issued_at: r.issued_at,
        pdf_url: r.pdf_url,
        enrollment_id: r.enrollment_id,
        course_title: r.academy_enrollments?.academy_courses?.title ?? "",
      }));
    setCertificates(mapped);
    setCertLoading(false);
  }, [user, audience]);

  const fetchPathways = useCallback(async () => {
    if (!user) { setPathways([]); return; }
    setPathwaysLoading(true);
    const [{ data: pRows }, { data: pcRows }, { data: certRows }, { data: pathCerts }] = await Promise.all([
      (supabase as any).from("academy_pathways").select("id, title, description").eq("is_published", true),
      (supabase as any).from("academy_pathway_courses").select("pathway_id, course_id, sort_order").order("sort_order"),
      supabase
        .from("academy_certificates")
        .select("enrollment_id, academy_enrollments!inner(teacher_id, course_id)")
        .eq("academy_enrollments.teacher_id", user.id),
      (supabase as any).from("academy_pathway_certificates").select("pathway_id, certificate_number").eq("teacher_id", user.id),
    ]);
    const completedCourseIds = new Set<string>(
      ((certRows as any[]) || []).map((r) => r.academy_enrollments?.course_id).filter(Boolean)
    );
    const certByPathway = new Map<string, string>();
    ((pathCerts as any[]) || []).forEach((r) => certByPathway.set(r.pathway_id, r.certificate_number));
    const byPathway = new Map<string, { total: number; completed: number }>();
    ((pcRows as any[]) || []).forEach((r) => {
      const bucket = byPathway.get(r.pathway_id) || { total: 0, completed: 0 };
      bucket.total += 1;
      if (completedCourseIds.has(r.course_id)) bucket.completed += 1;
      byPathway.set(r.pathway_id, bucket);
    });
    setPathways(
      ((pRows as any[]) || []).map((p) => {
        const b = byPathway.get(p.id) || { total: 0, completed: 0 };
        return {
          id: p.id,
          title: p.title,
          description: p.description,
          total: b.total,
          completed: b.completed,
          certificate_number: certByPathway.get(p.id) || null,
        };
      })
    );
    setPathwaysLoading(false);
  }, [user]);

  useEffect(() => { fetchCourses(); fetchCertificates(); fetchPathways(); }, [fetchCourses, fetchCertificates, fetchPathways]);


  const openCourse = async (courseId: string) => {
    if (!user) return;
    setSelectedCourseId(courseId);
    setActiveModuleId(null);

    let { data: enroll } = await supabase
      .from("academy_enrollments")
      .select("id, completed_at")
      .eq("teacher_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!enroll) {
      const { data: created, error } = await supabase
        .from("academy_enrollments")
        .insert({ teacher_id: user.id, course_id: courseId })
        .select("id, completed_at")
        .single();
      if (error) { toast.error("Nepodařilo se zapsat do kurzu"); return; }
      enroll = created;
    }
    setEnrollmentId(enroll!.id);
    setEnrollmentCompletedAt(enroll!.completed_at);

    const [{ data: mods }, { data: comps }, { data: evi }] = await Promise.all([
      supabase.from("academy_modules").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
      supabase.from("academy_module_completions").select("module_id").eq("enrollment_id", enroll!.id),
      supabase.from("academy_evidence_submissions").select("*").eq("enrollment_id", enroll!.id).order("submitted_at", { ascending: false }).limit(1),
    ]);
    setModules((mods || []) as Module[]);
    setCompletedIds(new Set((comps || []).map((c: any) => c.module_id)));
    setEvidence(((evi as any[]) || [])[0] || null);
    setEvidenceDesc("");
    setEvidenceFile(null);
    if (mods && mods.length > 0) setActiveModuleId(mods[0].id);
  };

  const reloadEvidence = useCallback(async () => {
    if (!enrollmentId) return;
    const { data } = await supabase
      .from("academy_evidence_submissions")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("submitted_at", { ascending: false })
      .limit(1);
    setEvidence(((data as any[]) || [])[0] || null);
  }, [enrollmentId]);

  const submitEvidence = async () => {
    if (!enrollmentId || !user) return;
    if (!evidenceDesc.trim()) {
      toast.error("Popište, jak jste poznatky uplatnil/a v praxi.");
      return;
    }
    setEvidenceSubmitting(true);
    try {
      let fileUrl: string | null = null;
      if (evidenceFile) {
        const ext = evidenceFile.name.split(".").pop() || "bin";
        const path = `${user.id}/${enrollmentId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("academy-evidence")
          .upload(path, evidenceFile, { upsert: false });
        if (upErr) throw upErr;
        fileUrl = path;
      }

      if (evidence && evidence.status === "rejected") {
        // Re-submit: reset to pending and update
        const { error } = await supabase
          .from("academy_evidence_submissions")
          .update({
            description: evidenceDesc.trim(),
            file_url: fileUrl ?? evidence.file_url,
            status: "pending",
            reviewer_comment: null,
            reviewed_at: null,
            reviewer_id: null,
            submitted_at: new Date().toISOString(),
          })
          .eq("id", evidence.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academy_evidence_submissions").insert({
          enrollment_id: enrollmentId,
          description: evidenceDesc.trim(),
          file_url: fileUrl,
        });
        if (error) throw error;
      }
      toast.success("Důkaz odeslán – čeká na posouzení.");
      setEvidenceDesc("");
      setEvidenceFile(null);
      await reloadEvidence();
    } catch (e: any) {
      toast.error("Odeslání selhalo", { description: e?.message });
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId) || null, [courses, selectedCourseId]);

  const triggerCertificate = useCallback(async (enrollId: string, courseIssuesCert: boolean) => {
    if (!courseIssuesCert) return;
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { enrollment_id: enrollId },
      });
      if (error) throw error;
      if (data?.download_url) {
        toast.success("🎓 Certifikát byl vydán! Zaslali jsme e-mail s odkazem.");
      }
      fetchCertificates();
    } catch (e: any) {
      console.warn("Certificate generation failed:", e);
    }
  }, [fetchCertificates]);

  const toggleModuleDone = async (moduleId: string) => {
    if (!enrollmentId || !selectedCourse) return;
    const done = completedIds.has(moduleId);
    if (done) {
      const { error } = await supabase.from("academy_module_completions").delete().eq("enrollment_id", enrollmentId).eq("module_id", moduleId);
      if (error) return toast.error("Chyba");
      const next = new Set(completedIds); next.delete(moduleId); setCompletedIds(next);
      if (enrollmentCompletedAt) {
        await supabase.from("academy_enrollments").update({ completed_at: null }).eq("id", enrollmentId);
        setEnrollmentCompletedAt(null);
      }
    } else {
      const { error } = await supabase.from("academy_module_completions").insert({ enrollment_id: enrollmentId, module_id: moduleId });
      if (error) return toast.error("Chyba");
      const next = new Set(completedIds); next.add(moduleId); setCompletedIds(next);
      if (modules.length > 0 && next.size === modules.length && !enrollmentCompletedAt) {
        const nowIso = new Date().toISOString();
        await supabase.from("academy_enrollments").update({ completed_at: nowIso }).eq("id", enrollmentId);
        setEnrollmentCompletedAt(nowIso);
        if (selectedCourse.requires_evidence && selectedCourse.issues_certificate) {
          toast.success("🎉 Moduly hotové! Nyní odevzdejte důkaz z praxe pro získání certifikátu.");
        } else {
          toast.success("🎉 Kurz dokončen!");
          triggerCertificate(enrollmentId, !!selectedCourse.issues_certificate);
        }
      }
    }
  };

  const backToList = () => {
    setSelectedCourseId(null); setModules([]); setCompletedIds(new Set());
    setEnrollmentId(null); setEnrollmentCompletedAt(null);
    setEvidence(null); setEvidenceDesc(""); setEvidenceFile(null);
    fetchCourses(); fetchCertificates(); fetchPathways();
  };

  const activeModule = useMemo(() => modules.find((m) => m.id === activeModuleId) || null, [modules, activeModuleId]);
  const progressPct = modules.length > 0 ? Math.round((completedIds.size / modules.length) * 100) : 0;

  const downloadCertificate = async (cert: CertificateRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { certificate_id: cert.id },
      });
      if (error) throw error;
      const url = (data as any)?.download_url;
      if (!url) throw new Error("Nepodařilo se získat odkaz");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error("Nepodařilo se stáhnout certifikát", { description: e?.message });
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {!selectedCourseId ? (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-semibold">{title || "Bezli Akademie"}</h1>
              <p className="text-sm text-muted-foreground">{subtitle || (audience === "teacher" ? "Kurzy a webináře pro učitele." : audience === "parent" ? "Kurzy a rady pro rodiče." : "Kurzy a doplňkové vzdělávání pro žáky.")}</p>
            </div>
          </div>

          <Tabs defaultValue="courses">
            <TabsList>
              <TabsTrigger value="courses">Kurzy</TabsTrigger>
              <TabsTrigger value="pathways">
                <GraduationCap className="w-4 h-4 mr-1" /> Kvalifikace
              </TabsTrigger>
              <TabsTrigger value="certificates">
                <FileBadge2 className="w-4 h-4 mr-1" /> Moje certifikáty
                {certificates.length > 0 && <Badge variant="secondary" className="ml-2">{certificates.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses" className="mt-4">
              {!loading && courses.length > 0 && (
                <div className="mb-4 p-3 rounded-xl border border-border bg-card flex flex-wrap items-end gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium mr-1">
                    <SlidersHorizontal className="w-4 h-4 text-primary" /> Filtry
                  </div>
                  {categories.length > 0 && (
                    <div className="w-[180px]">
                      <Label className="text-xs text-muted-foreground">Téma</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Všechna témata</SelectItem>
                          {categories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="w-[190px]">
                    <Label className="text-xs text-muted-foreground">Cílová skupina</Label>
                    <Select value={filterAudience} onValueChange={setFilterAudience}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Všechny</SelectItem>
                        <SelectItem value={audience}>{audience === "teacher" ? "Jen pro učitele" : audience === "parent" ? "Jen pro rodiče" : "Jen pro žáky"}</SelectItem>
                        <SelectItem value="both">Pro všechny skupiny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[170px]">

                    <Label className="text-xs text-muted-foreground">Certifikát</Label>
                    <Select value={filterCert} onValueChange={setFilterCert}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Nezáleží</SelectItem>
                        <SelectItem value="true">Vydává certifikát</SelectItem>
                        <SelectItem value="false">Bez certifikátu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[170px]">
                    <Label className="text-xs text-muted-foreground">Akreditace DVPP</Label>
                    <Select value={filterAccredited} onValueChange={setFilterAccredited}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Nezáleží</SelectItem>
                        <SelectItem value="true">Akreditovaný</SelectItem>
                        <SelectItem value="false">Neakreditovaný</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[150px]">
                    <Label className="text-xs text-muted-foreground">Cena</Label>
                    <Select value={filterPrice} onValueChange={setFilterPrice}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Nezáleží</SelectItem>
                        <SelectItem value="free">Zdarma</SelectItem>
                        <SelectItem value="paid">Placené</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filtersActive && (
                    <Button variant="ghost" size="sm" onClick={resetFilters}>Zrušit filtry</Button>
                  )}
                  <div className="text-xs text-muted-foreground ml-auto">{filteredCourses.length} z {courses.length} kurzů</div>
                </div>
              )}
              {loading ? (
                <p className="text-muted-foreground">Načítání…</p>
              ) : courses.length === 0 ? (
                <p className="text-muted-foreground">Zatím zde nejsou žádné kurzy.</p>
              ) : filteredCourses.length === 0 ? (
                <p className="text-muted-foreground">Žádný kurz neodpovídá zvoleným filtrům.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCourses.map((c) => {

                    const pct = c.moduleCount ? Math.round(((c.completedCount || 0) / c.moduleCount) * 100) : 0;
                    const priceLabel = c.price && Number(c.price) > 0 ? `${Number(c.price).toLocaleString("cs-CZ")} Kč` : "Zdarma";
                    return (
                      <Card key={c.id} className="p-5 flex flex-col hover:border-primary/40 transition-colors">
                        {c.cover_image_url && (<img src={c.cover_image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />)}
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          <h2 className="font-heading text-lg font-semibold flex-1">{c.title}</h2>
                          {c.is_accredited && (<Badge variant="secondary" className="gap-1"><Award className="w-3 h-3" /> DVPP</Badge>)}
                          {c.issues_certificate && (<Badge variant="outline" className="gap-1"><FileBadge2 className="w-3 h-3" /> Certifikát</Badge>)}
                        </div>
                        {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{c.description}</p>}
                        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                          <span>{c.moduleCount} modulů</span>
                          <span aria-hidden>·</span>
                          <span className={c.price && Number(c.price) > 0 ? "font-medium text-foreground" : ""}>{priceLabel}</span>
                        </div>
                        {c.enrollment && (
                          <div className="mb-3">
                            <Progress value={pct} className="h-2" />
                            <div className="text-xs text-muted-foreground mt-1">
                              {c.enrollment.completed_at ? "✓ Dokončeno" : `${c.completedCount}/${c.moduleCount} · ${pct} %`}
                            </div>
                          </div>
                        )}
                        <Button className="mt-auto" onClick={() => openCourse(c.id)}>
                          <Play className="w-4 h-4 mr-1" /> {c.enrollment ? "Pokračovat" : "Zahájit kurz"}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pathways" className="mt-4">
              {pathwaysLoading ? (
                <p className="text-muted-foreground">Načítání…</p>
              ) : pathways.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center">
                  <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Zatím zde nejsou žádné kvalifikace. Kvalifikace je skládaná z několika kurzů — po dokončení všech získáte celkový certifikát.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pathways.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                    const earned = !!p.certificate_number;
                    return (
                      <Card key={p.id} className="p-5 flex flex-col">
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          <h3 className="font-heading text-lg font-semibold flex-1">{p.title}</h3>
                          {earned && <Badge variant="secondary" className="gap-1"><Award className="w-3 h-3" /> Kvalifikace získána 🎓</Badge>}
                        </div>
                        {p.description && <p className="text-sm text-muted-foreground mb-3">{p.description}</p>}
                        <Progress value={pct} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1 mb-3">
                          {p.completed}/{p.total} kurzů · {pct} %
                        </div>
                        {earned && (
                          <div className="mt-auto flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{p.certificate_number}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const url = `${window.location.origin}/overit/${encodeURIComponent(p.certificate_number!)}`;
                                try {
                                  await navigator.clipboard.writeText(url);
                                  toast.success("Odkaz zkopírován.");
                                } catch {
                                  window.prompt("Zkopírujte odkaz:", url);
                                }
                              }}
                            >
                              <Share2 className="w-4 h-4 mr-1" /> Sdílet ověření
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="certificates" className="mt-4">
              {certLoading ? (
                <p className="text-muted-foreground">Načítání…</p>
              ) : certificates.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center">
                  <FileBadge2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Ještě nemáte žádné certifikáty. Dokončete kurz s vydáváním certifikátu, ať se tu objeví.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {certificates.map((c) => (
                    <Card key={c.id} className="p-4 flex items-center gap-3">
                      <FileBadge2 className="w-5 h-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.course_title}</div>
                        <div className="text-xs text-muted-foreground">
                          Č. {c.certificate_number} · Vydáno {new Date(c.issued_at).toLocaleDateString("cs-CZ")}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const url = `${window.location.origin}/overit/${encodeURIComponent(c.certificate_number)}`;
                          try {
                            await navigator.clipboard.writeText(url);
                            toast.success("Odkaz zkopírován – můžete ho sdílet na LinkedIn nebo jinde.");
                          } catch {
                            window.prompt("Zkopírujte odkaz:", url);
                          }
                        }}
                      >
                        <Share2 className="w-4 h-4 mr-1" /> Sdílet
                      </Button>
                      <Button size="sm" onClick={() => downloadCertificate(c)}>
                        <Download className="w-4 h-4 mr-1" /> Stáhnout PDF
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={backToList} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na kurzy
          </Button>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="font-heading text-2xl font-semibold">{selectedCourse?.title}</h1>
              {selectedCourse?.is_accredited && (<Badge variant="secondary" className="gap-1"><Award className="w-3 h-3" /> DVPP</Badge>)}
              {selectedCourse?.issues_certificate && (<Badge variant="outline" className="gap-1"><FileBadge2 className="w-3 h-3" /> Certifikát</Badge>)}
            </div>
            {selectedCourse?.description && (<p className="text-sm text-muted-foreground mb-3">{selectedCourse.description}</p>)}
            <Progress value={progressPct} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">{completedIds.size}/{modules.length} modulů · {progressPct} %</div>
            {enrollmentCompletedAt && !(selectedCourse?.requires_evidence && selectedCourse?.issues_certificate) && (
              <div className="mt-4 rounded-2xl border-2 border-primary/40 bg-primary/5 p-6 md:p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-brand-sm flex items-center justify-center mb-4">
                  <PartyPopper className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2">
                  Gratulujeme! Právě jsi dokončil/a kurz „{selectedCourse?.title}“
                </h2>
                {selectedCourse?.issues_certificate && (
                  <p className="text-muted-foreground max-w-xl mx-auto mb-2">
                    Certifikát ti dorazí e-mailem a najdeš ho i v sekci Moje certifikáty.
                  </p>
                )}
                <Button size="lg" className="mt-4" onClick={backToList}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Zpět do akademie
                </Button>
              </div>
            )}


            {enrollmentCompletedAt && selectedCourse?.requires_evidence && selectedCourse?.issues_certificate && (
              <div className="mt-3">
                <EvidencePanel
                  evidence={evidence}
                  evidenceDesc={evidenceDesc}
                  setEvidenceDesc={setEvidenceDesc}
                  evidenceFile={evidenceFile}
                  setEvidenceFile={setEvidenceFile}
                  submitting={evidenceSubmitting}
                  onSubmit={submitEvidence}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            <aside className="border border-border rounded-xl bg-card p-2 h-fit md:sticky md:top-4">
              <ul className="space-y-1">
                {modules.map((m, i) => {
                  const done = completedIds.has(m.id);
                  const active = m.id === activeModuleId;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setActiveModuleId(m.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-start gap-2 transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                      >
                        {done ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                        <span className="flex-1">
                          <span className="text-xs text-muted-foreground">Modul {i + 1}</span>
                          <span className="block">{m.title}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className="border border-border rounded-xl bg-card p-6">
              {activeModule ? (
                <>
                  <h2 className="font-heading text-xl font-semibold mb-3">{activeModule.title}</h2>
                  {activeModule.video_url && (
                    <div className="mb-4 aspect-video rounded-lg overflow-hidden bg-muted">
                      <iframe src={activeModule.video_url} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={activeModule.title} />
                    </div>
                  )}
                  {activeModule.content && renderContent(activeModule.content)}
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    <Button variant={completedIds.has(activeModule.id) ? "outline" : "default"} onClick={() => toggleModuleDone(activeModule.id)}>
                      {completedIds.has(activeModule.id) ? (<><CheckCircle2 className="w-4 h-4 mr-1" /> Splněno – zrušit</>) : (<><Circle className="w-4 h-4 mr-1" /> Označit jako dokončené</>)}
                    </Button>
                    {(() => {
                      const idx = modules.findIndex((m) => m.id === activeModule.id);
                      const next = modules[idx + 1];
                      return next ? (<Button variant="ghost" onClick={() => setActiveModuleId(next.id)}>Další modul →</Button>) : null;
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Vyberte modul ze seznamu.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default AcademyView;
