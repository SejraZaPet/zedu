import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Users, Globe, Lock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createShare,
  listMyShares,
  revokeAllShares,
  revokeShare,
  searchTeachers,
  shareLevelFromShares,
  TEACHER_SEARCH_MIN_LENGTH,
  type OutgoingShare,
  type ShareTargetKind,
} from "@/lib/content-shares";

import SchoolSalesStatusNotice from "@/components/school/SchoolSalesStatusNotice";

type Mode = "private" | "direct" | "public";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ShareTargetKind;
  targetId: string;
  targetTitle?: string;
  /** For textbook: whether worksheet inclusion checkbox is enabled */
  hasWorksheets?: boolean;
  /** For textbook: whether presentation inclusion checkbox is enabled */
  hasPresentations?: boolean;
  /** Zavolá se po každé změně sdílení, aby se obnovil seznam v rodiči. */
  onChanged?: () => void;
}

const KIND_LABEL: Record<ShareTargetKind, string> = {
  textbook: "učebnici",
  worksheet: "pracovní list",
  lesson_plan: "prezentaci",
};

export default function ShareContentDialog({
  open,
  onOpenChange,
  kind,
  targetId,
  targetTitle,
  hasWorksheets,
  hasPresentations,
  onChanged,
}: Props) {
  const { toast } = useToast();
  // Výchozí stav je vždy nejbezpečnější volba: nesdílet.
  const [mode, setMode] = useState<Mode>("private");
  const [includeWorksheets, setIncludeWorksheets] = useState(false);
  const [includePresentations, setIncludePresentations] = useState(false);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<
    { id: string; label: string; email: string | null; sameSchool?: boolean }[]
  >([]);
  const [selectedTeacher, setSelectedTeacher] = useState<
    { id: string; label: string } | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shares, setShares] = useState<OutgoingShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [confirmPrivate, setConfirmPrivate] = useState(false);

  const currentLevel = shareLevelFromShares(shares);

  const loadShares = useCallback(async () => {
    if (!targetId) return;
    setLoadingShares(true);
    try {
      setShares(await listMyShares(kind, targetId));
    } catch {
      setShares([]);
    } finally {
      setLoadingShares(false);
    }
  }, [kind, targetId]);

  useEffect(() => {
    if (!open) {
      setMode("private");
      setIncludeWorksheets(false);
      setIncludePresentations(false);
      setTeacherQuery("");
      setTeacherResults([]);
      setSelectedTeacher(null);
      setSearched(false);
      setShares([]);
      return;
    }
    void loadShares();
  }, [open, loadShares]);

  useEffect(() => {
    if (mode !== "direct") return;
    if (selectedTeacher) return;
    const q = teacherQuery.trim();
    if (q.length < TEACHER_SEARCH_MIN_LENGTH) {
      setTeacherResults([]);
      setSearched(false);
      return;
    }
    let cancel = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchTeachers(q);
        if (!cancel) setTeacherResults(r);
      } catch (e: any) {
        if (!cancel) setTeacherResults([]);
      } finally {
        if (!cancel) {
          setSearching(false);
          setSearched(true);
        }
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [teacherQuery, mode, selectedTeacher]);

  async function doShare(sharedWith: string | null) {
    setSaving(true);
    try {
      await createShare({
        kind,
        targetId,
        sharedWith,
        includesWorksheets: kind === "textbook" ? includeWorksheets : false,
        includesPresentations: kind === "textbook" ? includePresentations : false,
      });
      toast({
        title:
          sharedWith === null
            ? "Zveřejněno v Bezli Marketu"
            : `Sdíleno s ${selectedTeacher?.label ?? "učitelem"}`,
      });
      await loadShares();
      onChanged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Sdílení se nezdařilo", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (mode === "private") {
      if (shares.length === 0) {
        toast({ title: `Tato ${KIND_LABEL[kind]} je jen vaše — nic se nemění.` });
        onOpenChange(false);
        return;
      }
      setConfirmPrivate(true);
      return;
    }
    if (mode === "direct") {
      if (!selectedTeacher) {
        toast({ title: "Vyberte učitele", variant: "destructive" });
        return;
      }
      await doShare(selectedTeacher.id);
      return;
    }
    setConfirmPublic(true);
  }

  async function handleRevokeAll() {
    setSaving(true);
    try {
      const n = await revokeAllShares(kind, targetId);
      toast({
        title: "Sdílení zrušeno",
        description: `Zrušeno ${n} sdílení. Obsah je zpět jen váš.`,
      });
      await loadShares();
      onChanged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Nepodařilo se zrušit", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setConfirmPrivate(false);
    }
  }

  async function handleRevokeOne(share: OutgoingShare) {
    setSaving(true);
    try {
      await revokeShare(share.id);
      toast({
        title:
          share.sharedWith === null
            ? "Zveřejnění v Marketu zrušeno"
            : "Sdílení s učitelem zrušeno",
      });
      await loadShares();
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Nepodařilo se zrušit", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kdo tohle uvidí</DialogTitle>
            <DialogDescription>
              {targetTitle ? `„${targetTitle}"` : "Vyberte, komu chcete obsah zpřístupnit."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
            data-testid="share-current-level"
          >
            {currentLevel === "public" ? (
              <>
                <Globe className="h-4 w-4 text-primary" />
                <span className="font-medium">Nyní: veřejné v Bezli Marketu</span>
              </>
            ) : currentLevel === "shared" ? (
              <>
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  Nyní: sdíleno {shares.length === 1 ? "1 učiteli" : `${shares.length} učitelům`}
                </span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Nyní: jen moje (nesdíleno)</span>
              </>
            )}
            {loadingShares && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
          </div>

          {shares.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Aktivní sdílení</Label>
              <div className="rounded-md border border-border divide-y divide-border">
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {s.sharedWith === null ? (
                      <Globe className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Users className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="flex-1 truncate">
                      {s.sharedWith === null
                        ? "Veřejně v Bezli Marketu"
                        : s.recipientName ?? "Učitel"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive"
                      disabled={saving}
                      onClick={() => handleRevokeOne(s)}
                    >
                      <X className="h-3.5 w-3.5" /> Zrušit sdílení
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SchoolSalesStatusNotice />

          <div className="space-y-5">
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="grid gap-3"
            >
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="private" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Nesdílet — jen pro mě a moje třídy
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nikdo další obsah neuvidí. Vaši žáci k němu mají přístup jako dosud.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="direct" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Users className="w-4 h-4 text-primary" />
                    Sdílet konkrétnímu učiteli
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Obsah uvidí jen vybraný učitel v sekci „Sdíleno se mnou".
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="public" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Globe className="w-4 h-4 text-primary" />
                    Nabídnout veřejně v Bezli Marketu
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Kterýkoli učitel si obsah může přidat do svých materiálů.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {mode === "direct" && (
              <div className="space-y-2">
                <Label>Vyhledat učitele</Label>
                {selectedTeacher ? (
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span>{selectedTeacher.label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTeacher(null)}
                    >
                      Změnit
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Jméno, příjmení nebo celý e-mail"
                      value={teacherQuery}
                      onChange={(e) => setTeacherQuery(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Stačí {TEACHER_SEARCH_MIN_LENGTH} znaky jména. E-mail musí být zadaný celý.
                    </p>
                    {searching && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Hledám…
                      </div>
                    )}
                    {!searching && searched && teacherResults.length === 0 && (
                      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                        Nikdo nenalezen. Zkuste jiné jméno nebo zadejte celý e-mail kolegy.
                      </div>
                    )}
                    {teacherResults.length > 0 && (
                      <div className="max-h-56 overflow-auto rounded-md border border-border">
                        {teacherResults.map((r) => (
                          <button
                            key={r.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                            onClick={() => setSelectedTeacher(r)}
                          >
                            <div className="font-medium">
                              {r.label}
                              {r.sameSchool && (
                                <span className="ml-2 text-xs font-normal text-primary">
                                  vaše škola
                                </span>
                              )}
                            </div>
                            {r.email && (
                              <div className="text-xs text-muted-foreground">
                                {r.email}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {kind === "textbook" && mode !== "private" && (
              <div className="space-y-2">
                <Label className="text-sm">Zahrnout s učebnicí</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={includeWorksheets}
                      disabled={hasWorksheets === false}
                      onCheckedChange={(c) => setIncludeWorksheets(!!c)}
                    />
                    Pracovní listy
                    {hasWorksheets === false && (
                      <span className="text-xs text-muted-foreground">
                        (žádné navázané)
                      </span>
                    )}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={includePresentations}
                      disabled={hasPresentations === false}
                      onCheckedChange={(c) => setIncludePresentations(!!c)}
                    />
                    Prezentace
                    {hasPresentations === false && (
                      <span className="text-xs text-muted-foreground">
                        (žádné navázané)
                      </span>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Zavřít
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "private" ? "Nastavit jako jen moje" : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPublic} onOpenChange={setConfirmPublic}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zveřejnit v Bezli Marketu?</AlertDialogTitle>
            <AlertDialogDescription>
              Obsah uvidí a může si zkopírovat kterýkoli učitel v Bezli. Zveřejnění můžete
              později zrušit tlačítkem „Zrušit sdílení".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setConfirmPublic(false);
                void doShare(null);
              }}
            >
              Ano, zveřejnit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPrivate} onOpenChange={setConfirmPrivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zrušit všechna sdílení?</AlertDialogTitle>
            <AlertDialogDescription>
              Obsah bude znovu jen váš. Učitelé, kterým jste ho sdílela, ho přestanou vidět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ponechat</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevokeAll();
              }}
            >
              Ano, nesdílet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
