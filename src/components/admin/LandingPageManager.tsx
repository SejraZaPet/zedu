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
import { Plus, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAllLandingSections, type LandingSectionRow, type LandingSectionType } from "@/hooks/useLandingSections";
import { DEFAULT_PROPS_BY_TYPE } from "@/lib/landing-defaults";
import { SortableSectionCard } from "./landing/SortableSectionCard";
import { LandingSectionEditorDialog } from "./landing/LandingSectionEditorDialog";
import { AddSectionDialog } from "./landing/AddSectionDialog";

export default function LandingPageManager() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useAllLandingSections();
  const sections = useMemo(() => data ?? [], [data]);

  const [editing, setEditing] = useState<LandingSectionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LandingSectionRow | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["landing_sections"] });
    qc.invalidateQueries({ queryKey: ["landing_sections", "all"] });
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sections, oldIndex, newIndex);
    // Renumber order_index in 10-unit increments so future inserts are easy.
    const updates = reordered.map((s, i) => ({ id: s.id, order_index: (i + 1) * 10 }));

    // Optimistic cache update.
    qc.setQueryData(["landing_sections", "all"], reordered.map((s, i) => ({ ...s, order_index: (i + 1) * 10 })));

    try {
      // Update rows individually to keep RLS happy (bulk upsert would require conflict target).
      await Promise.all(
        updates.map((u) =>
          supabase.from("landing_sections").update({ order_index: u.order_index }).eq("id", u.id),
        ),
      );
      invalidate();
    } catch (err: any) {
      toast.error("Přeuspořádání selhalo: " + (err?.message || "neznámá chyba"));
      invalidate();
    }
  };

  const handleToggleEnabled = async (section: LandingSectionRow, enabled: boolean) => {
    const { error } = await supabase.from("landing_sections").update({ enabled }).eq("id", section.id);
    if (error) {
      toast.error("Nepodařilo se změnit viditelnost: " + error.message);
    } else {
      toast.success(enabled ? "Sekce aktivována" : "Sekce skryta");
      invalidate();
    }
  };

  const handleSaveEdit = async (nextProps: Record<string, any>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("landing_sections")
        .update({ props: nextProps })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Sekce uložena");
      invalidate();
    } catch (err: any) {
      toast.error("Uložení selhalo: " + (err?.message || "neznámá chyba"));
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (type: LandingSectionType) => {
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.order_index), 0);
    const { data: inserted, error } = await supabase
      .from("landing_sections")
      .insert({
        section_type: type,
        order_index: maxOrder + 10,
        enabled: true,
        props: DEFAULT_PROPS_BY_TYPE[type] ?? {},
      })
      .select()
      .single();
    if (error) {
      toast.error("Přidání selhalo: " + error.message);
      return;
    }
    toast.success("Sekce přidána — nyní ji upravte");
    invalidate();
    if (inserted) setEditing(inserted as LandingSectionRow);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("landing_sections").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Smazání selhalo: " + error.message);
    } else {
      toast.success("Sekce smazána");
      invalidate();
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Landing page</h2>
          <p className="text-sm text-muted-foreground">
            Přetáhněte sekce pro přeuspořádání. Změny pořadí a viditelnosti se ukládají okamžitě.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" /> Zobrazit landing
            </a>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Přidat sekci
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Načítám sekce…
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Nepodařilo se načíst sekce.</p>}

      {!isLoading && sections.length === 0 && (
        <p className="text-sm text-muted-foreground">Žádné sekce. Přidejte první tlačítkem výše.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sections.map((s) => (
              <SortableSectionCard
                key={s.id}
                section={s}
                onEdit={() => setEditing(s)}
                onDelete={() => setDeleteTarget(s)}
                onToggleEnabled={(enabled) => handleToggleEnabled(s, enabled)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editing && (
        <LandingSectionEditorDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          sectionType={editing.section_type}
          initialProps={editing.props}
          onSave={handleSaveEdit}
          saving={saving}
        />
      )}

      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onPick={handleAdd}
        existingTypes={sections.map((s) => s.section_type)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat sekci?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Sekci můžete alternativně jen skrýt přepínačem „Aktivní".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
