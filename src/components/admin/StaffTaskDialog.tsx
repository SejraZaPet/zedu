import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
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
  /** Umožní vybrat adresáta z týmu (výchozí: pevně `assignedTo`) */
  allowPickAssignee?: boolean;
  onCreated?: () => void;
}

type Member = { id: string; name: string };

/** Formulář pro vytvoření pracovního úkolu (vlastního i přiřazeného kolegovi). */
const StaffTaskDialog = ({ open, onOpenChange, assignedTo, assignedBy, assigneeName, allowPickAssignee, onCreated }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [color, setColor] = useState<string>(DEFAULT_STAFF_COLOR);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState(assignedTo);
  const [members, setMembers] = useState<Member[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { if (open) setTarget(assignedTo); }, [open, assignedTo]);

  /** Seznam interního týmu (staff + admini) pro výběr adresáta */
  useEffect(() => {
    if (!open || !allowPickAssignee || members.length) return;
    void (async () => {
      const [{ data: staff }, { data: adminRoles }] = await Promise.all([
        supabase.from("staff_members").select("profile_id").eq("active", true),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const ids = Array.from(new Set([
        ...(staff ?? []).map((s: any) => s.profile_id),
        ...(adminRoles ?? []).map((r: any) => r.user_id),
      ]));
      if (!ids.length) return;
      const { data: profiles } = await supabase
        .from("profiles").select("id, first_name, last_name, email").in("id", ids);
      setMembers(
        (profiles ?? [])
          .map((p: any) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Bez jména",
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "cs")),
      );
    })();
  }, [open, allowPickAssignee, members.length]);

  const targetName = useMemo(
    () => members.find((m) => m.id === target)?.name ?? (target === assignedBy ? "Já" : assigneeName ?? "Vyberte osobu"),
    [members, target, assignedBy, assigneeName],
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("normal");
    setColor(DEFAULT_STAFF_COLOR);
    setTarget(assignedTo);
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
      assigned_to: target || assignedTo,
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
          {allowPickAssignee && (
            <div className="space-y-1">
              <Label>Přiřadit komu</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={pickerOpen} className="w-full justify-between font-normal">
                    {targetName}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Hledat člena týmu…" />
                    <CommandList>
                      <CommandEmpty>Nikdo nenalezen.</CommandEmpty>
                      <CommandGroup>
                        {members.map((m) => (
                          <CommandItem
                            key={m.id}
                            value={m.name}
                            onSelect={() => { setTarget(m.id); setPickerOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${target === m.id ? "opacity-100" : "opacity-0"}`} />
                            {m.name}{m.id === assignedBy ? " (já)" : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

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
