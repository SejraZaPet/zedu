import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, FileUp, BookOpen, Pencil, LayoutTemplate, Gamepad2, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TeacherGames from "@/pages/TeacherGames";
import ActivitiesPage from "@/pages/ActivitiesPage";
import StudioSetBuilder, { type StudioStart } from "@/components/studio/StudioSetBuilder";
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
  const [builder, setBuilder] = useState<{ start: StudioStart; edit: GameTemplate | null } | null>(null);

  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t as StudioTab);
    setParams(next); // push → funguje Zpět i sdílení odkazu
  };
  const reload = () => setReloadKey((k) => k + 1);

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
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setBuilder({ start: "material", edit: null })}>
                  <FileUp className="w-4 h-4" /> Z mého materiálu
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setBuilder({ start: "lesson", edit: null })}>
                  <BookOpen className="w-4 h-4" /> Z lekce
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setBuilder({ start: "blank", edit: null })}>
                  <Pencil className="w-4 h-4" /> Od nuly
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setBuilder({ start: "template", edit: null })}>
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
              <TeacherGames reloadKey={reloadKey} onEditStudioSet={(t) => setBuilder({ start: "blank", edit: t })} />
            </TabsContent>
            <TabsContent value="aktivity">
              <ActivitiesPage embedded />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <SiteFooter />

      <StudioSetBuilder open={!!builder} onOpenChange={(o) => { if (!o) setBuilder(null); }}
        start={builder?.start ?? "blank"} editTemplate={builder?.edit ?? null}
        onSaved={() => { reload(); if (tab !== "hry") setTab("hry"); }} />
    </div>
  );
};

export default StudioPage;
