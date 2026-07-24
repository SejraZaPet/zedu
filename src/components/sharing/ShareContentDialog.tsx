import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Users, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createShare,
  searchTeachers,
  type ShareTargetKind,
} from "@/lib/content-shares";

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
}

export default function ShareContentDialog({
  open,
  onOpenChange,
  kind,
  targetId,
  targetTitle,
  hasWorksheets,
  hasPresentations,
}: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"public" | "direct">("public");
  const [includeWorksheets, setIncludeWorksheets] = useState(false);
  const [includePresentations, setIncludePresentations] = useState(false);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teacherResults, setTeacherResults] = useState<
    { id: string; label: string; email: string | null }[]
  >([]);
  const [selectedTeacher, setSelectedTeacher] = useState<
    { id: string; label: string } | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("public");
      setIncludeWorksheets(false);
      setIncludePresentations(false);
      setTeacherQuery("");
      setTeacherResults([]);
      setSelectedTeacher(null);
    }
  }, [open]);

  useEffect(() => {
    if (mode !== "direct") return;
    if (selectedTeacher) return;
    const q = teacherQuery.trim();
    if (q.length < 2) {
      setTeacherResults([]);
      return;
    }
    let cancel = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchTeachers(q);
        if (!cancel) setTeacherResults(r);
      } finally {
        if (!cancel) setSearching(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [teacherQuery, mode, selectedTeacher]);

  async function handleSubmit() {
    if (mode === "direct" && !selectedTeacher) {
      toast({ title: "Vyberte učitele", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createShare({
        kind,
        targetId,
        sharedWith: mode === "public" ? null : selectedTeacher!.id,
        includesWorksheets: kind === "textbook" ? includeWorksheets : false,
        includesPresentations: kind === "textbook" ? includePresentations : false,
      });
      toast({
        title:
          mode === "public"
            ? "Nabídnuto v ZEduMarket"
            : `Sdíleno s ${selectedTeacher!.label}`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Sdílení se nezdařilo",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sdílet obsah</DialogTitle>
          <DialogDescription>
            {targetTitle ? `„${targetTitle}"` : "Vyberte, jak chcete obsah nabídnout."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "public" | "direct")}
            className="grid gap-3"
          >
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="public" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Globe className="w-4 h-4 text-primary" />
                  Nabídnout veřejně v ZEduMarket
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kterýkoli učitel si obsah může přidat do svých materiálů.
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
                    placeholder="Jméno, příjmení nebo e-mail…"
                    value={teacherQuery}
                    onChange={(e) => setTeacherQuery(e.target.value)}
                  />
                  {searching && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Hledám…
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
                          <div className="font-medium">{r.label}</div>
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

          {kind === "textbook" && (
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
            Zrušit
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sdílet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
