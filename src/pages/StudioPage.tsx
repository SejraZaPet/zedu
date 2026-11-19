import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, FileUp, BookOpen, Pencil, LayoutTemplate, Gamepad2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import TeacherGames from "@/pages/TeacherGames";
import ActivitiesPage from "@/pages/ActivitiesPage";
import FromSourceActivityPanel from "@/components/studio/FromSourceActivityPanel";
import { QuickGameDialog } from "@/components/game/QuickGameDialog";
import { GameTemplateEditorDialog } from "@/components/game/GameTemplateEditorDialog";
import type { GameTemplate } from "@/lib/game-templates";
import { studioTabFromSearch, type StudioTab } from "@/lib/studio-routes";

/**
 * Jediné místo „Studio – aktivity a hry“: skládá stávající knihovnu her (TeacherGames)
 * a katalog aktivit (ActivitiesPage embedded). Herní logiku nemění.
 */
const StudioPage = () => {
  const [params, setParams] = useSearchParams();
  const tab = studioTabFromSearch(`?${params.toString()}`);
  const [reloadKey, setReloadKey] = useState(0);
  const [fromSourceOpen, setFromSourceOpen] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [fromLessonOpen, setFromLessonOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<GameTemplate | null>(null);

  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t as StudioTab);
    setParams(next); // push → funguje Zpět i sdílení odkazu
  };
  const reload = () => setReloadKey((k) => k + 1);

  /** Sada z vlastního materiálu se uloží jako běžná hra v knihovně a otevře se k doladění. */
  const saveFromSource = async (slides: any[]) => {
    if (!slides.length) return;
    setSavingSource(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Nejste přihlášeni.");
      const first = slides[0] as any;
      const title = String(first?.title || first?.question || "Sada z mého materiálu").slice(0, 120);
      const { data, error } = await supabase.from("teacher_game_templates" as any).insert({
        teacher_id: session.user.id,
        title,
        activity_data: slides,
        default_game_mode: "standard",
        default_team_mode: "none",
      } as any).select().single();
      if (error) throw error;
      toast.success("Sada uložena do Studia. Zkontrolujte ji a pojmenujte.");
      setFromSourceOpen(false);
      reload();
      if (tab !== "hry") setTab("hry");
      setEditing(data as unknown as GameTemplate);
      setEditorOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Sadu se nepodařilo uložit.");
    } finally {
      setSavingSource(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo title="Studio – aktivity a hry | Bezli" description="Sady, hry a aktivity pro výuku na jednom místě." path="/ucitel/studio" />
      <SiteHeader />
      <main className="flex-1 pb-16 px-4 md:px-8" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
                <Gamepad2 className="w-7 h-7 text-primary" aria-hidden /> Studio
              </h1>
              <p className="text-muted-foreground font-heading text-lg">aktivity a hry</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" className="gap-2 min-h-12 w-full sm:w-auto">
                  <Plus className="w-5 h-5" /> Nová sada
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setFromSourceOpen(true)}>
                  <FileUp className="w-4 h-4" /> Z mého materiálu
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setFromLessonOpen(true)}>
                  <BookOpen className="w-4 h-4" /> Z lekce
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => { setEditing(null); setEditorOpen(true); }}>
                  <Pencil className="w-4 h-4" /> Od nuly
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setTab("aktivity")}>
                  <LayoutTemplate className="w-4 h-4" /> Ze šablony
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="hry" className="flex-1 sm:flex-none gap-1.5 min-h-10">
                <Gamepad2 className="w-4 h-4" /> Sady a hry
              </TabsTrigger>
              <TabsTrigger value="aktivity" className="flex-1 sm:flex-none gap-1.5 min-h-10">
                <Sparkles className="w-4 h-4" /> Aktivity a šablony
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hry" className="pt-4">
              <TeacherGames reloadKey={reloadKey} />
            </TabsContent>
            <TabsContent value="aktivity">
              <ActivitiesPage embedded />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <SiteFooter />

      <Dialog open={fromSourceOpen} onOpenChange={(o) => { if (!savingSource) setFromSourceOpen(o); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nová sada z mého materiálu</DialogTitle>
            <DialogDescription>Vložte text, soubory, fotky nebo odkaz. Návrh AI před uložením zkontrolujete.</DialogDescription>
          </DialogHeader>
          <FromSourceActivityPanel busy={savingSource} onInsert={saveFromSource} />
        </DialogContent>
      </Dialog>
      <QuickGameDialog open={fromLessonOpen} onOpenChange={setFromLessonOpen} onSaved={reload} startFromLesson />
      <GameTemplateEditorDialog open={editorOpen} onOpenChange={setEditorOpen} template={editing} onSaved={reload} />
    </div>
  );
};

export default StudioPage;
