import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ColorSwatchPicker from "./ColorSwatchPicker";
import { DEFAULT_STAFF_COLOR } from "@/lib/staff-colors";


export const TASK_PRIORITIES = [
  { value: "low", label: "Nízká" },
  { value: "normal", label: "Běžná" },
  { value: "high", label: "Vysoká" },
] as const;

export const TASK_STATUSES = [
  { value: "todo", label: "K řešení" },
  { value: "in_progress", label: "V řešení" },
  { value: "done", label: "Hotovo" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Komu úkol patří */
  assignedTo: string;
  /** Kdo úkol zadává (přihlášený uživatel) */
  assignedBy: string;
  /** Jméno adresáta – zobrazí se v titulku, pokud jde o jiného člověka */
  assigneeName?: string;
  onCreated?: () => void;
}

/** Formulář pro vytvoření pracovního úkolu (vlastního i přiřazeného kolegovi). */
const StaffTaskDialog = ({ open, onOpenChange, assignedTo, assignedBy, assigneeName, onCreated }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [color, setColor] = useState<string>(DEFAULT_STAFF_COLOR);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("normal");
    setColor(DEFAULT_STAFF_COLOR);
  };

  const save = async () => {
    const t = title.trim();
    if (!t) {
      toast({ title: "Zadejte název úkolu", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("staff_tasks").insert({
      title: t,
      description: description.trim() || null,
      assigned_to: assignedTo,
      assigned_by: assignedBy,
      due_date: dueDate || null,
      priority,
      color,
      status: "todo",
    });

    setSaving(false);
    if (error) {
      toast({ title: "Úkol nelze uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Úkol vytvořen" });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {assigneeName ? `Přiřadit úkol — ${assigneeName}` : "Nový úkol"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="task-title">Název</Label>
            <Input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-desc">Popis</Label>
            <Textarea id="task-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="task-due">Termín</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Priorita</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ColorSwatchPicker value={color} onChange={setColor} />

          <Button className="w-full" disabled={saving} onClick={() => void save()}>
            {saving ? "Ukládám…" : "Vytvořit úkol"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StaffTaskDialog;
