import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Library, Archive, ArchiveRestore, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import { useAuth } from "@/contexts/AuthContext";
import SubjectPicker from "@/components/subjects/SubjectPicker";
import { useSubjectCatalog, useInvalidateSubjectCatalog } from "@/hooks/useSubjectCatalog";
import {
  deleteSubject,
  fetchSubjectDependencies,
  setSubjectArchived,
  type SubjectCatalogItem,
} from "@/lib/subjects-catalog";

const colorForLabel = (s: string) => {
  const palette = ["#6EC6D9", "#9B6CFF", "#F472B6", "#F87171", "#FB923C", "#FBBF24", "#34D399", "#60A5FA", "#A3A3A3"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

interface SubjectClassEntry {
  classId: string;
  className: string;
  subjectLabel: string;
  abbreviation: string;
  color: string;
  room: string;
}

const TeacherSubjects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { classes, loading: loadingClasses } = useTeacherClasses();
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Management of the canonical `subjects` catalog
  const { allSubjects, loading: loadingCatalog } = useSubjectCatalog({ includeArchived: true });
  const { units, loading: loadingUnits } = useTeachingUnits();
  const invalidateCatalog = useInvalidateSubjectCatalog();
  const [showArchived, setShowArchived] = useState(false);
  const [deps, setDeps] = useState<Record<string, { groups: number; classSubjects: number }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SubjectCatalogItem | null>(null);

  useEffect(() => {
    if (loadingClasses) return;
    if (classes.length === 0) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    supabase
      .from("class_schedule_slots")
      .select("class_id, subject_label, abbreviation, color, room, subject_id, subjects(name, color, abbreviation, archived)")
      .in("class_id", classes.map((c) => c.id))
      .then(({ data }) => {
        setSlots(data ?? []);
        setLoadingSlots(false);
      });
  }, [classes, loadingClasses]);

  /** Subjects this teacher works with: authored by them or present in their schedule. */
  const mySubjects = useMemo(() => {
    const usedIds = new Set(
      slots.map((s) => s.subject_id).filter(Boolean) as string[],
    );
    return allSubjects
      .filter((s) => s.created_by === user?.id || usedIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [allSubjects, slots, user?.id]);

  const visibleSubjects = useMemo(
    () => mySubjects.filter((s) => (showArchived ? true : !s.archived)),
    [mySubjects, showArchived],
  );

  const archivedCount = mySubjects.filter((s) => s.archived).length;

  // Dependency counts decide whether "Smazat" may be offered at all.
  useEffect(() => {
    const ids = mySubjects.filter((s) => s.created_by === user?.id).map((s) => s.id);
    if (ids.length === 0) {
      setDeps({});
      return;
    }
    let cancelled = false;
    fetchSubjectDependencies(ids)
      .then((d) => {
        if (!cancelled) setDeps(d);
      })
      .catch(() => {
        // On failure we simply never offer deletion.
        if (!cancelled) setDeps({});
      });
    return () => {
      cancelled = true;
    };
  }, [mySubjects, user?.id]);

  const canDelete = (s: SubjectCatalogItem) => {
    if (s.created_by !== user?.id) return false;
    const d = deps[s.id];
    return !!d && d.groups === 0 && d.classSubjects === 0;
  };

  const handleArchive = async (s: SubjectCatalogItem, archived: boolean) => {
    setBusyId(s.id);
    try {
      await setSubjectArchived(s.id, archived);
      invalidateCatalog();
      toast.success(
        archived ? `Předmět „${s.name}" byl archivován.` : `Předmět „${s.name}" byl obnoven.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Změnu se nepodařilo uložit.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    try {
      await deleteSubject(toDelete.id);
      invalidateCatalog();
      toast.success(`Předmět „${toDelete.name}" byl smazán.`);
      setToDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Předmět se nepodařilo smazat.");
    } finally {
      setBusyId(null);
    }
  };

  const entries: SubjectClassEntry[] = useMemo(() => {
    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const seen = new Map<string, SubjectClassEntry>();
    for (const s of slots) {
      // Prefer the canonical catalog name (subject_id join), fall back to the
      // legacy free-text label so older rows never disappear.
      const canonical = (s as any).subjects as
        | { name?: string; color?: string | null; abbreviation?: string | null; archived?: boolean }
        | null
        | undefined;
      // Archived subjects stay out of the regular overview.
      if (canonical?.archived && !showArchived) continue;
      const label = (canonical?.name || s.subject_label || "").trim();
      if (!label) continue;
      const key = `${s.class_id}::${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      const className = classMap.get(s.class_id) || "";
      const abbr = (canonical?.abbreviation || s.abbreviation || label.slice(0, 3)).toUpperCase();
      seen.set(key, {
        classId: s.class_id,
        className,
        subjectLabel: label,
        abbreviation: abbr,
        color: canonical?.color || s.color || colorForLabel(label),
        room: s.room || "",
      });
    }
    return Array.from(seen.values()).sort((a, b) => {
      const c = a.subjectLabel.localeCompare(b.subjectLabel, "cs");
      if (c !== 0) return c;
      return a.className.localeCompare(b.className, "cs");
    });
  }, [slots, classes, showArchived]);

  const loading = loadingClasses || loadingSlots;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na přehled
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
            <Library className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje předměty</h1>
            <p className="text-muted-foreground text-sm">
              Předměty přiřazené k vašim třídám podle rozvrhu
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-8">
          <p className="text-sm font-medium mb-1">Nový předmět</p>
          <p className="text-xs text-muted-foreground mb-3">
            Napište název předmětu a potvrďte „Založit předmět“. Poté ho můžete přiřadit
            do rozvrhu, ke třídě nebo k učebnici.
          </p>
          <div className="max-w-sm">
            <SubjectPicker
              value={null}
              placeholder="Vybrat nebo založit předmět…"
              onChange={({ subjectId, name }) => {
                if (subjectId) {
                  navigate(`/ucitel/skupiny?subjectId=${encodeURIComponent(subjectId)}`);
                } else if (name) {
                  // Pokud uživatel založil úplně nový předmět, přejdi na skupiny
                  // s prázdným výběrem — nový předmět se načte v seznamu.
                  navigate("/ucitel/skupiny");
                }
              }}
            />
          </div>
        </div>

        {/* ───────── Správa předmětů (katalog) ───────── */}
        <section className="bg-card border border-border rounded-xl p-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <p className="text-sm font-medium">Správa předmětů</p>
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived-subjects"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived-subjects" className="text-xs font-normal">
                Zobrazit archivované{archivedCount > 0 ? ` (${archivedCount})` : ""}
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Archivovaný předmět zůstává v databázi, ale appka ho už nenabízí pro nové
            vazby. Smazat lze jen vlastní předmět bez navázaných skupin a tříd.
          </p>

          {loadingCatalog ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
            </div>
          ) : visibleSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {mySubjects.length === 0
                ? "Zatím nemáte žádné vlastní předměty."
                : "Všechny vaše předměty jsou archivované — zapněte přepínač výše."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleSubjects.map((s) => {
                const d = deps[s.id];
                const busy = busyId === s.id;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => navigate(`/ucitel/predmety/${s.id}`)}
                      className={`text-sm font-medium text-left hover:text-primary hover:underline ${s.archived ? "opacity-60" : ""}`}
                      title="Otevřít detail předmětu (ŠVP, třídy a skupiny)"
                    >
                      {s.name}
                    </button>
                    {s.archived && <Badge variant="outline">Archivováno</Badge>}
                    {s.created_by !== user?.id && (
                      <Badge variant="secondary">Cizí předmět</Badge>
                    )}
                    {d && (d.groups > 0 || d.classSubjects > 0) && (
                      <span className="text-xs text-muted-foreground">
                        {d.groups} skupin · {d.classSubjects} tříd
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {s.archived ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleArchive(s, false)}
                        >
                          <ArchiveRestore className="w-4 h-4 mr-1" /> Obnovit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleArchive(s, true)}
                        >
                          <Archive className="w-4 h-4 mr-1" /> Archivovat
                        </Button>
                      )}
                      {canDelete(s) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={busy}
                          onClick={() => setToDelete(s)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Smazat
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold mb-1">Výuka</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Každá karta je jedna Výuka — předmět v konkrétní třídě nebo skupině. Vazby vznikají
            v Předmětech a skupinách nebo automaticky z rozvrhu.
          </p>

          {loading || loadingUnits ? (
            <div className="text-muted-foreground">Načítání...</div>
          ) : units.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground">
                Zatím nemáte žádnou Výuku. Přiřaďte předmět třídě nebo skupině — rozvrh k tomu
                není potřeba.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <Button onClick={() => navigate("/ucitel/skupiny")}>
                  Předměty a skupiny
                </Button>
                <Button variant="outline" onClick={() => navigate("/ucitel/rozvrh")}>
                  Otevřít rozvrh
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {units.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => navigate(u.path)}
                  title={`Výuka: ${u.subjectName} · ${u.targetName}`}
                  className="text-left rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-sm transition-all bg-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold text-white px-2 py-1 rounded"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.abbreviation}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {u.targetName}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate">{u.subjectName}</div>
                  {u.kind === "group" && (
                    <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0 h-4 font-normal">
                      skupina
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat předmět „{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tento předmět nemá žádné skupiny ani třídy, smazání je nevratné.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Smazat nevratně
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeacherSubjects;
