import { useEffect, useMemo, useRef, useState } from "react";
import { CHEATSHEET_STORAGE_MARKER } from "@/lib/cheatsheet";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { notebookPageText, savePracticeSource, type PracticeSource } from "@/lib/practice-method";
import { PRACTICE_PHOTO_PRIVACY_NOTICE } from "@/lib/practice-photo";
import { usePracticePhotos } from "@/lib/use-practice-photos";
import { useDemoPair } from "@/lib/demo";
import { MIN_SOURCE_TEXT_LENGTH, SOURCE_TEXT_LIMIT } from "../../supabase/functions/_shared/practice-phases";
import { SelectGroup, SelectLabel } from "@/components/ui/select";
import { fetchStudentPracticeLessons, type PracticeLessonGroup } from "@/lib/student-practice-lessons";
import { methodPurpose, PRACTICE_DURATIONS, questionCountForDuration } from "@/lib/study-method-info";
import {
  Brain, BookOpen, ListChecks, Sparkles, MapPin, Timer,
  NotebookPen, ArrowRightCircle, GraduationCap, Play, ChevronLeft, ChevronRight, CheckCircle2,
  Camera, Loader2, Images, ArrowUp, ArrowDown, Trash2, RotateCcw,
} from "lucide-react";

type Method = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  steps_json: { name: string; description: string }[] | null;
};


const ICONS: Record<string, React.ElementType> = {
  Brain, BookOpen, ListChecks, Sparkles, MapPin, Timer, NotebookPen, ArrowRightCircle,
};

const StudentMethods = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [methods, setMethods] = useState<Method[]>([]);
  const [preferredIds, setPreferredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Method | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [practiceFor, setPracticeFor] = useState<Method | null>(null);
  const [lessonGroups, setLessonGroups] = useState<PracticeLessonGroup[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<string>("none");
  const [duration, setDuration] = useState<string>("15");
  const [submitting, setSubmitting] = useState(false);
  const [sourceKind, setSourceKind] = useState<"lesson" | "text" | "file" | "photo" | "notebook">("lesson");
  const [customText, setCustomText] = useState("");
  const [fileSource, setFileSource] = useState<{ text: string; label: string } | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const demoPair = useDemoPair();
  const photos = usePracticePhotos((description) => toast({ title: "Příliš mnoho fotek", description, variant: "destructive" }));
  const { busy: photoBusy, text: photoText, setText: setPhotoText, review: photoReview, setReview: setPhotoReview,
    confirmed: photoConfirmed, setConfirmed: setPhotoConfirmed } = photos;
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sourceKind !== "photo" || !practiceFor) {
      photos.clear();
      setPhotoError(null);
    }
  }, [sourceKind, practiceFor]);
  const [notebooks, setNotebooks] = useState<{ id: string; title: string }[]>([]);
  const [notebookId, setNotebookId] = useState("");
  const [pages, setPages] = useState<{ id: string; order: number; text: string }[]>([]);
  const [pageId, setPageId] = useState("");

  useEffect(() => {
    if (!practiceFor || sourceKind !== "notebook") return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("notebooks").select("id, title").eq("owner_id", session.user.id).or(`cover_color.is.null,cover_color.neq.${CHEATSHEET_STORAGE_MARKER}`).order("title");
      setNotebooks((data ?? []) as any);
    })();
  }, [practiceFor, sourceKind]);

  useEffect(() => {
    setPages([]); setPageId("");
    if (!notebookId) return;
    (async () => {
      const { data } = await supabase.from("notebook_pages").select("id, page_order, content")
        .eq("notebook_id", notebookId).order("page_order");
      setPages(((data ?? []) as any[]).map((r) => ({ id: r.id, order: r.page_order, text: notebookPageText(r.content) })));
    })();
  }, [notebookId]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileBusy(true);
    try {
      let text = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const { extractPdfText } = await import("@/lib/pdf-page-renderer");
        text = (await extractPdfText(file)).text;
      } else {
        text = await file.text();
      }
      text = text.trim();
      if (text.length < MIN_SOURCE_TEXT_LENGTH) {
        setFileSource(null);
        toast({ title: "V souboru je málo textu", description: "Zkus jiný soubor nebo text vlož ručně.", variant: "destructive" });
      } else {
        setFileSource({ text: text.slice(0, SOURCE_TEXT_LIMIT), label: file.name });
      }
    } catch {
      setFileSource(null);
      toast({ title: "Soubor se nepodařilo přečíst", description: "Zkus PDF s textem nebo soubor .txt.", variant: "destructive" });
    } finally {
      setFileBusy(false);
    }
  };

  const handlePhotoTextChange = (value: string) => {
    setPhotoText(value);
    setPhotoConfirmed(false);
    setPhotoError(null);
  };

  const handlePhotoConfirm = () => {
    const text = photoText.trim();
    if (text.length < MIN_SOURCE_TEXT_LENGTH) {
      setPhotoError(`Text je moc krátký. Potřebuju aspoň ${MIN_SOURCE_TEXT_LENGTH} znaků.`);
      setPhotoConfirmed(false);
      return;
    }
    if (text.length > SOURCE_TEXT_LIMIT) {
      setPhotoError(`Text je moc dlouhý. Zkrať ho na ${SOURCE_TEXT_LIMIT} znaků.`);
      setPhotoConfirmed(false);
      return;
    }
    setPhotoText(text);
    setPhotoError(null);
    setPhotoConfirmed(true);
  };

  const handlePhotoEdit = () => {
    setPhotoReview(true);
    setPhotoConfirmed(false);
    requestAnimationFrame(() => photoTextRef.current?.focus());
  };

  const chosenSource = ((): PracticeSource | null => {
    if (sourceKind === "text") return { kind: "text", text: customText.slice(0, SOURCE_TEXT_LIMIT), label: "Vlastní text" };
    if (sourceKind === "file") return fileSource ? { kind: "file", ...fileSource } : null;
    if (sourceKind === "photo") {
      return photoConfirmed ? { kind: "photo", text: photoText, label: "Fotografie" } : null;
    }
    if (sourceKind === "notebook") {
      const pg = pages.find((x) => x.id === pageId);
      const nb = notebooks.find((x) => x.id === notebookId);
      return pg ? { kind: "notebook", text: pg.text, label: `Sešit ${nb?.title ?? ""}, strana ${pg.order + 1}` } : null;
    }
    return null;
  })();
  const sourceTooShort = sourceKind !== "lesson" && (!chosenSource || chosenSource.text.trim().length < MIN_SOURCE_TEXT_LENGTH);
  const sourceTooLong = sourceKind === "photo" && photoText.trim().length > SOURCE_TEXT_LIMIT;

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("study_methods")
        .select("id, name, slug, description, icon, steps_json")
        .order("name");
      if (error) {
        toast({ title: "Chyba načítání", description: error.message, variant: "destructive" });
      } else {
        setMethods((data ?? []) as any);
      }
      if (session) {
        const { data: prefs } = await supabase
          .from("student_preferred_methods")
          .select("method_id")
          .eq("student_id", session.user.id);
        setPreferredIds(((prefs ?? []) as any[]).map((p) => p.method_id));
      }
      setLoading(false);
    })();
  }, [toast]);

  useEffect(() => {
    if (!practiceFor) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setLessonsLoading(true);
      try {
        const groups = await fetchStudentPracticeLessons(session.user.id);
        if (!cancelled) setLessonGroups(groups);
      } catch {
        if (!cancelled) setLessonGroups([]);
      } finally {
        if (!cancelled) setLessonsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [practiceFor]);

  const openDetail = (m: Method) => {
    setDetail(m);
    setStepIdx(0);
  };

  // „Jak technika funguje“ z lišty u lekce: /student/metody?navod=<slug>
  const [searchParams, setSearchParams] = useSearchParams();
  const guideSlug = searchParams.get("navod");
  useEffect(() => {
    if (!guideSlug || methods.length === 0) return;
    const m = methods.find((x) => x.slug === guideSlug);
    if (m) openDetail(m);
    const next = new URLSearchParams(searchParams);
    next.delete("navod");
    setSearchParams(next, { replace: true });
  }, [guideSlug, methods]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPractice = () => {
    if (!practiceFor) return;
    const params = new URLSearchParams();
    if (sourceKind === "lesson") {
      if (selectedLesson !== "none") params.set("lesson", selectedLesson);
    } else {
      if (!chosenSource || !savePracticeSource(chosenSource)) {
        toast({ title: "Materiál se nepodařilo připravit", variant: "destructive" });
        return;
      }
      params.set("source", "custom");
    }
    params.set("min", duration);
    navigate(`/student/metody/${practiceFor.slug}/procviceni?${params.toString()}`);
    setPracticeFor(null);
    setSelectedLesson("none");
    setDuration("15");
  };

  const detailSteps = useMemo(() => detail?.steps_json ?? [], [detail]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <GraduationCap className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Učím se</span>
          </div>
          <h1 className="font-heading text-3xl font-bold">Jak se učit chytře</h1>
          <p className="text-muted-foreground mt-1">
            Vyber si techniku, vyber učivo a nech si z něj udělat procvičení. Každá technika má krátký návod.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Načítání...</p>
        ) : (() => {
          const preferred = methods.filter((m) => preferredIds.includes(m.id));
          const others = methods.filter((m) => !preferredIds.includes(m.id));

          const renderCard = (m: Method, big: boolean) => {
            const Icon = (m.icon && ICONS[m.icon]) || Brain;
            return (
              <button
                key={m.id}
                onClick={() => openDetail(m)}
                className={`relative text-left bg-card border rounded-xl hover:shadow-md transition-all flex flex-col ${
                  big
                    ? "p-7 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent shadow-sm hover:border-primary"
                    : "p-5 border-border hover:border-primary/40"
                }`}
              >
                {big && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Oblíbená
                  </span>
                )}
                <div
                  className={`rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 ${
                    big ? "w-16 h-16" : "w-12 h-12"
                  }`}
                >
                  <Icon className={`text-primary ${big ? "w-8 h-8" : "w-6 h-6"}`} />
                </div>
                <h3 className={`font-heading font-semibold mb-1 ${big ? "text-2xl" : "text-lg"}`}>{m.name}</h3>
                {methodPurpose(m.slug) && (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-foreground/80">{methodPurpose(m.slug)!.purpose}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      <Timer className="w-3 h-3" aria-hidden /> {methodPurpose(m.slug)!.duration}
                    </span>
                  </div>
                )}
                {m.description && (
                  <p className={`text-muted-foreground ${big ? "text-base line-clamp-4" : "text-sm line-clamp-3"}`}>
                    {m.description}
                  </p>
                )}
                <span className="mt-3 text-sm font-medium text-primary">Zobrazit návod →</span>
              </button>
            );
          };

          return (
            <div className="space-y-10">
              {preferred.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h2 className="font-heading text-xl font-semibold">Tvoje oblíbené</h2>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {preferred.map((m) => renderCard(m, true))}
                  </div>
                </section>
              )}
              <section>
                {preferred.length > 0 && (
                  <h2 className="font-heading text-xl font-semibold mb-3">Další metody</h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map((m) => renderCard(m, false))}
                </div>
                {preferred.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Tip: V profilu si můžeš vybrat až 3 oblíbené metody — budou se ti zobrazovat nahoře.
                  </p>
                )}
              </section>
            </div>
          );
        })()}
      </main>
      <SiteFooter />

      {/* Step-by-step detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          {detail && (() => {
            const Icon = (detail.icon && ICONS[detail.icon]) || Brain;
            const total = detailSteps.length;
            const step = detailSteps[stepIdx];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle>{detail.name}</DialogTitle>
                      {detail.description && (
                        <DialogDescription className="mt-1">{detail.description}</DialogDescription>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                {total > 0 && step && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Krok {stepIdx + 1} z {total}
                      </span>
                      <div className="flex gap-1">
                        {detailSteps.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-6 rounded-full transition-colors ${
                              i <= stepIdx ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                          {stepIdx + 1}
                        </div>
                        <div>
                          <h4 className="font-heading font-semibold text-lg mb-1">{step.name}</h4>
                          <p className="text-sm text-foreground/80">{step.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                        disabled={stepIdx === 0}
                        className="gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" /> Zpět
                      </Button>
                      {stepIdx < total - 1 ? (
                        <Button onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))} className="gap-2">
                          Další <ChevronRight className="w-4 h-4" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-primary font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Hotovo
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <DialogFooter className="mt-4">
                  <Button variant="ghost" onClick={() => setDetail(null)}>Zavřít</Button>
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setPracticeFor(detail);
                      setDetail(null);
                    }}
                  >
                    <Play className="w-4 h-4" /> Procvičit
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Practice setup */}
      <Dialog open={!!practiceFor} onOpenChange={(o) => {
        if (!o) {
          setPracticeFor(null);
          photos.clear();
          setPhotoError(null);
          setPhotoText("");
          setPhotoReview(false);
          setPhotoConfirmed(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Procvičit metodou {practiceFor?.name}</DialogTitle>
            <DialogDescription>
              Vyber, z čeho se budeš učit, a kolik minut chceš věnovat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label htmlFor="practice-source">Zdroj</Label>
              <Select value={sourceKind} onValueChange={(v) => setSourceKind(v as any)}>
                <SelectTrigger id="practice-source" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lesson">Lekce z učebnice</SelectItem>
                  <SelectItem value="text">Vlastní text</SelectItem>
                  <SelectItem value="file">Soubor (PDF nebo .txt)</SelectItem>
                  <SelectItem value="photo">Fotografie</SelectItem>
                  <SelectItem value="notebook">Stránka mého sešitu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceKind === "text" && (
              <div>
                <Label htmlFor="practice-text">Tvůj text</Label>
                <Textarea id="practice-text" rows={7} maxLength={SOURCE_TEXT_LIMIT} value={customText}
                  onChange={(e) => setCustomText(e.target.value)} className="mt-1 text-base"
                  placeholder="Vlož sem zápis, výpisky nebo text z učebnice." />
                <p className="text-xs text-muted-foreground mt-1">
                  {customText.length} / {SOURCE_TEXT_LIMIT} znaků (aspoň {MIN_SOURCE_TEXT_LENGTH}). Text se nikam neukládá, použije se jen pro otázky.
                </p>
              </div>
            )}

            {sourceKind === "file" && (
              <div>
                <Label htmlFor="practice-file">Soubor</Label>
                <Input id="practice-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" className="mt-1"
                  disabled={fileBusy} onChange={(e) => handleFile(e.target.files?.[0])} />
                <p className="text-xs text-muted-foreground mt-1">
                  {fileBusy ? "Čtu soubor…" : fileSource ? `Načteno: ${fileSource.label} (${fileSource.text.length} znaků)` : "PDF s textem nebo .txt. Fotky zatím neumíme přečíst."}
                </p>
              </div>
            )}

            {sourceKind === "photo" && (
              <div className="space-y-3 min-w-0">
                <p className="text-sm rounded-md border border-border bg-muted/40 p-3">{PRACTICE_PHOTO_PRIVACY_NOTICE}</p>
                {demoPair && <p role="note" className="text-sm border border-border rounded-md p-3">Demo účet má limit 5 AI volání. Každá fotka spotřebuje jedno volání; další volání potřebuje i procvičování. Více fotek může limit vyčerpat.</p>}
                <input ref={photoInputRef} id="practice-photo" type="file" accept="image/*" multiple className="hidden" disabled={photoBusy}
                  onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void photos.add(files); }} />
                <input ref={cameraInputRef} id="practice-photo-camera" type="file" accept="image/*" capture="environment" className="hidden" disabled={photoBusy}
                  onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void photos.add(files); }} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={photoBusy} onClick={() => photoInputRef.current?.click()}><Images className="h-4 w-4" />Vybrat fotografie</Button>
                  <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={photoBusy} onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4" />Vyfotit stránku</Button>
                </div>
                <p className="text-xs text-muted-foreground">{photos.entries.length} / 6 fotek</p>
                {photoBusy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{photos.progress}</p>}
                <ol className="space-y-3">
                  {photos.entries.map((entry, index) => (
                    <li key={entry.id} className="rounded-md border border-border p-3 space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Fotka {index + 1}</span>
                        <div className="flex shrink-0">
                          <Button type="button" variant="ghost" size="icon" title="Posunout nahoru" aria-label={`Fotka ${index + 1}: nahoru`} disabled={photoBusy || index === 0} onClick={() => photos.move(entry.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" title="Posunout dolů" aria-label={`Fotka ${index + 1}: dolů`} disabled={photoBusy || index === photos.entries.length - 1} onClick={() => photos.move(entry.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" title="Odebrat fotku" aria-label={`Fotka ${index + 1}: odebrat`} disabled={photoBusy} onClick={() => photos.remove(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      {entry.photo && <img src={entry.photo.previewUrl} alt="Náhled fotografie stránky s učivem" className="max-h-48 w-full rounded-md object-contain" />}
                      {entry.text && <p className="text-xs text-primary">Přepsáno AI</p>}
                      {entry.error && <><p role="alert" className="text-sm text-destructive break-words">{entry.error}</p><Button type="button" variant="outline" className="gap-2" disabled={photoBusy} onClick={() => void photos.retry(entry.id)}><RotateCcw className="h-4 w-4" />Zkusit znovu</Button></>}
                    </li>
                  ))}
                </ol>
                {photos.entries.some((entry) => !entry.text && !entry.error) && <Button type="button" className="min-h-11 w-full gap-2" disabled={photoBusy} onClick={() => void photos.transcribe()}><Sparkles className="h-4 w-4" />{photos.entries.length === 1 ? "Přečíst text z fotky" : "Přečíst text z fotek"}</Button>}
                {photos.entries.length > 0 && <Button type="button" variant="outline" className="min-h-11" disabled={photoBusy} onClick={handlePhotoEdit}>Upravit / doplnit ručně</Button>}
                {photoReview && (
                  <div className="space-y-3">
                    <Label htmlFor="practice-photo-text" className="font-medium">Přepsáno AI – zkontroluj text</Label>
                    <Textarea ref={photoTextRef} id="practice-photo-text" rows={8} value={photoText} onChange={(event) => handlePhotoTextChange(event.target.value)} className="mt-1 text-base" placeholder="Doplň nebo opiš text z fotek." disabled={photoBusy} />
                    <p className="text-xs text-muted-foreground">{photoText.trim().length} / {SOURCE_TEXT_LIMIT} znaků (aspoň {MIN_SOURCE_TEXT_LENGTH}). Fotky se neukládají; po potvrzení se použije jen tento text.</p>
                    {(photoError || sourceTooLong) && <p role="alert" className="text-sm text-destructive">{sourceTooLong ? `Text je moc dlouhý. Zkrať ho na ${SOURCE_TEXT_LIMIT} znaků; žádný text nebyl oříznut.` : photoError}</p>}
                    <Button type="button" className="min-h-11 w-full" disabled={photoBusy || photoText.trim().length < MIN_SOURCE_TEXT_LENGTH || sourceTooLong} onClick={handlePhotoConfirm}>Potvrdit text</Button>
                    {photoConfirmed && <p role="status" className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Text je potvrzený. Teď můžeš spustit procvičování.</p>}
                  </div>
                )}
              </div>
            )}

            {sourceKind === "notebook" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="practice-notebook">Sešit</Label>
                  <Select value={notebookId} onValueChange={setNotebookId}>
                    <SelectTrigger id="practice-notebook" className="mt-1"><SelectValue placeholder="Vyber sešit" /></SelectTrigger>
                    <SelectContent>
                      {notebooks.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {notebooks.length === 0 && <p className="text-xs text-muted-foreground mt-1">Zatím nemáš žádný sešit.</p>}
                </div>
                {notebookId && (
                  <div>
                    <Label htmlFor="practice-page">Stránka</Label>
                    <Select value={pageId} onValueChange={setPageId}>
                      <SelectTrigger id="practice-page" className="mt-1"><SelectValue placeholder="Vyber stránku" /></SelectTrigger>
                      <SelectContent>
                        {pages.map((pg) => (
                          <SelectItem key={pg.id} value={pg.id} disabled={!pg.text}>
                            Strana {pg.order + 1}{pg.text ? ` – ${pg.text.slice(0, 40)}${pg.text.length > 40 ? "…" : ""}` : " – bez textu – rukopis zatím neumíme číst"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Použijeme jen text z textových polí na stránce.</p>
                  </div>
                )}
              </div>
            )}

            {sourceKind !== "lesson" && sourceTooShort && (sourceKind !== "photo" || photoReview) && (
              <p className="text-xs text-muted-foreground">Potřebuju aspoň {MIN_SOURCE_TEXT_LENGTH} znaků textu.</p>
            )}
            {sourceTooLong && (
              <p className="text-xs text-muted-foreground">Text je potřeba zkrátit na {SOURCE_TEXT_LIMIT} znaků.</p>
            )}

            {sourceKind === "lesson" && (
            <div>
              <Label>Lekce z učebnice (volitelné)</Label>
              <Select value={selectedLesson} onValueChange={setSelectedLesson}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Vyber lekci" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez konkrétní lekce</SelectItem>
                  {lessonGroups.map((g) => (
                    <SelectGroup key={g.subject}>
                      <SelectLabel>{g.subject}</SelectLabel>
                      {g.lessons.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.title}
                          {l.textbook && l.textbook !== g.subject ? ` — ${l.textbook}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {lessonsLoading ? (
                <p className="text-xs text-muted-foreground mt-1">Načítám tvoje lekce…</p>
              ) : lessonGroups.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Zatím nemáš žádné lekce z učebnic. Jakmile ti učitel zveřejní lekci, objeví se tady. Můžeš procvičovat i bez lekce.
                </p>
              )}
            </div>
            )}

            <div>
              <Label htmlFor="duration">Délka (minuty)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} min · {questionCountForDuration(d)} otázek
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPracticeFor(null)}>Zrušit</Button>
            <Button onClick={startPractice} disabled={submitting || sourceTooShort || sourceTooLong || fileBusy || photoBusy} className="gap-2">
              <Play className="w-4 h-4" /> Spustit procvičování
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentMethods;
