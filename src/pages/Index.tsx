import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SocialProof from "@/components/landing/SocialProof";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import HowItWorks from "@/components/landing/HowItWorks";
import ForWhom from "@/components/landing/ForWhom";
import PlatformShowcase from "@/components/landing/PlatformShowcase";
import PodcastSection from "@/components/PodcastSection";
import FinalCTA from "@/components/landing/FinalCTA";
import SiteFooter from "@/components/SiteFooter";
import AdminButton from "@/components/AdminButton";
import { useLandingSections, useAllLandingSections, type LandingSectionRow, type LandingSectionType } from "@/hooks/useLandingSections";
import { LandingEditModeProvider, useLandingEditMode } from "@/contexts/LandingEditModeContext";
import AdminEditToggle from "@/components/landing-edit/AdminEditToggle";
import EditModeFloatingBar from "@/components/landing-edit/EditModeFloatingBar";
import EditableSectionWrapper from "@/components/landing-edit/EditableSectionWrapper";
import SortableSection from "@/components/landing-edit/SortableSection";
import InsertSectionSlot from "@/components/landing-edit/InsertSectionSlot";
import LandingEditSidePanel from "@/components/landing-edit/LandingEditSidePanel";
import { AddSectionDialog } from "@/components/admin/landing/AddSectionDialog";
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
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PROPS_BY_TYPE } from "@/lib/landing-defaults";

const COMPONENT_BY_TYPE: Record<string, React.ComponentType<{ props?: any }>> = {
  hero: Hero,
  social_proof: SocialProof,
  features_grid: FeaturesGrid,
  how_it_works: HowItWorks,
  for_whom: ForWhom,
  platform_showcase: PlatformShowcase,
  podcast: PodcastSection,
  final_cta: FinalCTA,
};

// Fallback order used before the DB responds — matches the original hardcoded layout.
const FALLBACK_ORDER: LandingSectionRow[] = [
  { id: "hero", order_index: 10, section_type: "hero", enabled: true, props: {} },
  { id: "social_proof", order_index: 20, section_type: "social_proof", enabled: true, props: {} },
  { id: "features_grid", order_index: 30, section_type: "features_grid", enabled: true, props: {} },
  { id: "how_it_works", order_index: 40, section_type: "how_it_works", enabled: true, props: {} },
  { id: "for_whom", order_index: 50, section_type: "for_whom", enabled: true, props: {} },
  { id: "platform_showcase", order_index: 60, section_type: "platform_showcase", enabled: true, props: {} },
  { id: "podcast", order_index: 70, section_type: "podcast", enabled: true, props: {} },
  { id: "final_cta", order_index: 80, section_type: "final_cta", enabled: true, props: {} },
];

function LandingSections() {
  const qc = useQueryClient();
  const { isEditMode, getEffectiveProps } = useLandingEditMode();

  // In edit mode fetch all rows (including disabled) so the admin can manage them.
  const publicQuery = useLandingSections();
  const allQuery = useAllLandingSections();
  const active = isEditMode ? allQuery : publicQuery;
  const rows = active.data;
  const sections = useMemo(() => {
    if (!active.isLoading && !active.isError && rows && rows.length > 0) {
      return isEditMode ? rows : rows.filter((s) => s.enabled);
    }
    return FALLBACK_ORDER;
  }, [rows, active.isLoading, active.isError, isEditMode]);

  const [addAt, setAddAt] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LandingSectionRow | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["landing_sections"] });
    qc.invalidateQueries({ queryKey: ["landing_sections", "all"] });
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === a.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sections, oldIndex, newIndex);
    const updated = reordered.map((s, i) => ({ ...s, order_index: (i + 1) * 10 }));

    // Optimistic caches (both queries).
    qc.setQueryData(["landing_sections", "all"], updated);
    qc.setQueryData(["landing_sections"], updated.filter((s) => s.enabled));

    try {
      const results = await Promise.all(
        updated.map((u) => supabase.from("landing_sections").update({ order_index: u.order_index }).eq("id", u.id)),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      invalidate();
    } catch (err: any) {
      toast.error("Přeuspořádání selhalo: " + (err?.message || "neznámá chyba"));
      invalidate();
    }
  };

  const handleInsert = async (type: LandingSectionType) => {
    if (addAt === null) return;
    const prev = sections[addAt - 1];
    const next = sections[addAt];
    let order_index: number;
    if (!prev && next) order_index = next.order_index - 5;
    else if (prev && !next) order_index = prev.order_index + 10;
    else if (prev && next) order_index = Math.floor((prev.order_index + next.order_index) / 2);
    else order_index = 10;

    // Fallback if the gap collapsed to zero — renumber everything with breathing room.
    if (prev && next && (order_index === prev.order_index || order_index === next.order_index)) {
      const withInsert = [...sections.slice(0, addAt), { placeholder: true } as any, ...sections.slice(addAt)];
      await Promise.all(
        withInsert.map((s, i) => {
          if ((s as any).placeholder) return Promise.resolve({ error: null });
          return supabase.from("landing_sections").update({ order_index: (i + 1) * 10 }).eq("id", (s as LandingSectionRow).id);
        }),
      );
      order_index = (addAt + 1) * 10;
    }

    const { error } = await supabase.from("landing_sections").insert({
      section_type: type,
      order_index,
      enabled: true,
      props: DEFAULT_PROPS_BY_TYPE[type] ?? {},
    });
    if (error) {
      toast.error("Přidání selhalo: " + error.message);
    } else {
      toast.success("Sekce přidána");
      invalidate();
    }
    setAddAt(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("landing_sections").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Smazání selhalo: " + error.message);
    else {
      toast.success("Sekce smazána");
      invalidate();
    }
    setDeleteTarget(null);
  };

  const renderSectionBody = (section: LandingSectionRow) => {
    const Component = COMPONENT_BY_TYPE[section.section_type];
    if (!Component) return null;
    const props = getEffectiveProps(section);
    return <Component props={props} />;
  };

  if (!isEditMode) {
    return (
      <>
        {sections.map((section) => {
          const body = renderSectionBody(section);
          if (!body) return null;
          return (
            <EditableSectionWrapper key={section.id} section={section}>
              {body}
            </EditableSectionWrapper>
          );
        })}
      </>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, i) => {
            const body = renderSectionBody(section);
            if (!body) return null;
            return (
              <div key={section.id}>
                <InsertSectionSlot onClick={() => setAddAt(i)} />
                <SortableSection section={section} onDelete={() => setDeleteTarget(section)}>
                  {body}
                </SortableSection>
              </div>
            );
          })}
          <InsertSectionSlot onClick={() => setAddAt(sections.length)} label="Přidat sekci na konec" />
        </SortableContext>
      </DndContext>

      <LandingEditSidePanel sections={sections} />

      <AddSectionDialog
        open={addAt !== null}
        onOpenChange={(o) => !o && setAddAt(null)}
        onPick={handleInsert}
        existingTypes={sections.map((s) => s.section_type)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat sekci?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná a uloží se okamžitě. Sekci lze alternativně jen skrýt v /admin/landing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const Index = () => {
  return (
    <LandingEditModeProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main>
          <LandingSections />
        </main>
        <SiteFooter />
        <AdminButton />
        <AdminEditToggle />
        <EditModeFloatingBar />
      </div>
    </LandingEditModeProvider>
  );
};

export default Index;
