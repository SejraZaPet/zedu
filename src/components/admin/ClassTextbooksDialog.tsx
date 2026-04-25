import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Plus, Trash2, BookOpen, Search } from "lucide-react";

type TextbookType = "global" | "teacher";

interface LinkedItem {
  textbook_id: string;
  textbook_type: TextbookType;
  title: string;
  subtitle: string;
}

interface AvailableItem {
  id: string;
  title: string;
  subtitle: string;
}

interface Props {
  classId: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ClassTextbooksDialog = ({ classId, className, open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<LinkedItem[]>([]);
  const [availableGlobal, setAvailableGlobal] = useState<AvailableItem[]>([]);
  const [availableTeacher, setAvailableTeacher] = useState<AvailableItem[]>([]);
  const [tab, setTab] = useState<TextbookType>("global");
  const [searchGlobal, setSearchGlobal] = useState("");
  const [searchTeacher, setSearchTeacher] = useState("");
  const [removeTarget, setRemoveTarget] = useState<LinkedItem | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    // Linked
    const { data: links } = await supabase
      .from("class_textbooks")
      .select("textbook_id, textbook_type")
      .eq("class_id", classId);

    const globalIds = (links ?? []).filter(l => l.textbook_type === "global").map(l => l.textbook_id);
    const teacherIds = (links ?? []).filter(l => l.textbook_type === "teacher").map(l => l.textbook_id);

    const [linkedGlobalRes, linkedTeacherRes] = await Promise.all([
      globalIds.length > 0
        ? supabase.from("textbook_subjects").select("id, label, abbreviation, description").in("id", globalIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIds.length > 0
        ? supabase.from("teacher_textbooks").select("id, title, subject, description").in("id", teacherIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const linkedItems: LinkedItem[] = [
      ...((linkedGlobalRes.data ?? []) as any[]).map((g) => ({
        textbook_id: g.id,
        textbook_type: "global" as const,
        title: g.label,
        subtitle: g.abbreviation || g.description || "",
      })),
      ...((linkedTeacherRes.data ?? []) as any[]).map((t) => ({
        textbook_id: t.id,
        textbook_type: "teacher" as const,
        title: t.title,
        subtitle: t.subject || t.description || "",
      })),
    ];
    setLinked(linkedItems);

    // Available global
    const { data: allGlobal } = await supabase
      .from("textbook_subjects")
      .select("id, label, abbreviation")
      .eq("active", true)
      .order("label");
    const globalSet = new Set(globalIds);
    setAvailableGlobal(
      ((allGlobal ?? []) as any[])
        .filter((g) => !globalSet.has(g.id))
        .map((g) => ({ id: g.id, title: g.label, subtitle: g.abbreviation || "" }))
    );

    // Available teacher (mine)
    const { data: allTeacher } = await supabase
      .from("teacher_textbooks")
      .select("id, title, subject")
      .eq("teacher_id", session.user.id)
      .order("title");
    const teacherSet = new Set(teacherIds);
    setAvailableTeacher(
      ((allTeacher ?? []) as any[])
        .filter((t) => !teacherSet.has(t.id))
        .map((t) => ({ id: t.id, title: t.title, subtitle: t.subject || "" }))
    );

    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchAll();
  }, [open, classId]);

  const handleAdd = async (textbookId: string, type: TextbookType) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("class_textbooks").insert({
      class_id: classId,
      textbook_id: textbookId,
      textbook_type: type,
      added_by: session.user.id,
    });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Přidáno", description: "Učebnice byla připojena ke třídě." });
    fetchAll();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const { error } = await supabase
      .from("class_textbooks")
      .delete()
      .eq("class_id", classId)
      .eq("textbook_id", removeTarget.textbook_id)
      .eq("textbook_type", removeTarget.textbook_type);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Odebráno", description: "Učebnice byla odebrána ze třídy." });
    setRemoveTarget(null);
    fetchAll();
  };

  const filteredGlobal = useMemo(() => {
    const s = searchGlobal.toLowerCase().trim();
    if (!s) return availableGlobal;
    return availableGlobal.filter(
      (x) => x.title.toLowerCase().includes(s) || x.subtitle.toLowerCase().includes(s)
    );
  }, [availableGlobal, searchGlobal]);

  const filteredTeacher = useMemo(() => {
    const s = searchTeacher.toLowerCase().trim();
    if (!s) return availableTeacher;
    return availableTeacher.filter(
      (x) => x.title.toLowerCase().includes(s) || x.subtitle.toLowerCase().includes(s)
    );
  }, [availableTeacher, searchTeacher]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Učebnice třídy {className}
            </DialogTitle>
            <DialogDescription>
              Žáci ve třídě uvidí přidané učebnice automaticky ve své stránce „Moje učebnice".
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Načítání...</p>
          ) : (
            <div className="space-y-6">
              {/* Linked */}
              <section>
                <h3 className="font-semibold mb-3">Aktuálně přidané učebnice</h3>
                {linked.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
                    Zatím žádné učebnice. Přidej je níže.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {linked.map((it) => (
                      <li
                        key={`${it.textbook_type}-${it.textbook_id}`}
                        className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Badge
                            variant="outline"
                            className={
                              it.textbook_type === "global"
                                ? "bg-blue-500/15 text-blue-500 border-blue-500/30 shrink-0"
                                : "bg-teal-500/15 text-teal-500 border-teal-500/30 shrink-0"
                            }
                          >
                            {it.textbook_type === "global" ? "Globální" : "Moje"}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{it.title}</p>
                            {it.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setRemoveTarget(it)}
                          title="Odebrat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Add */}
              <section>
                <h3 className="font-semibold mb-3">Přidat učebnici</h3>
                <Tabs value={tab} onValueChange={(v) => setTab(v as TextbookType)}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="global">Globální učebnice</TabsTrigger>
                    <TabsTrigger value="teacher">Mé učebnice</TabsTrigger>
                  </TabsList>

                  <TabsContent value="global" className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Hledat..."
                        value={searchGlobal}
                        onChange={(e) => setSearchGlobal(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {filteredGlobal.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Žádné další učebnice k přidání.
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-72 overflow-y-auto">
                        {filteredGlobal.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{it.title}</p>
                              {it.subtitle && (
                                <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                              )}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleAdd(it.id, "global")}>
                              <Plus className="w-4 h-4 mr-1" /> Přidat
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="teacher" className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Hledat..."
                        value={searchTeacher}
                        onChange={(e) => setSearchTeacher(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {filteredTeacher.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Žádné další učebnice k přidání.
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-72 overflow-y-auto">
                        {filteredTeacher.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{it.title}</p>
                              {it.subtitle && (
                                <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                              )}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleAdd(it.id, "teacher")}>
                              <Plus className="w-4 h-4 mr-1" /> Přidat
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odebrat učebnici?</AlertDialogTitle>
            <AlertDialogDescription>
              Učebnice „{removeTarget?.title}" bude odebrána ze třídy. Žáci ji ve své stránce už neuvidí.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Odebrat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClassTextbooksDialog;
