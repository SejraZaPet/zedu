import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
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

/** Minimální podoba úkolu potřebná k předvyplnění formuláře při editaci. */
export interface EditableTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  color: string | null;
  assigned_to: string;
}

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
  /** Existující úkol → formulář se přepne do režimu editace */
  editing?: EditableTask | null;
  /** Vazba na CRM organizaci (klienta) – uloží se u nového úkolu */
  relatedOrganizationId?: string | null;
  /** Vazba na konkrétního uživatele (učitele/lektora) – uloží se u nového úkolu */
  relatedUserId?: string | null;
  onCreated?: () => void;
}


type Member = { id: string; name: string };
type SubItem = { id: string; title: string; is_done: boolean; sort_order: number };

/** Formulář pro vytvoření i editaci pracovního úkolu (vlastního i přiřazeného kolegovi). */
const StaffTaskDialog = ({
  open,
  onOpenChange,
  assignedTo,
  assignedBy,
  assigneeName,
  allowPickAssignee,
  editing,
  relatedOrganizationId,
  relatedUserId,
  onCreated,
}: Props) => {

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [status, setStatus] = useState<string>("todo");
  const [color, setColor] = useState<string>(DEFAULT_STAFF_COLOR);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState(assignedTo);
  const [members, setMembers] = useState<Member[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [newSub, setNewSub] = useState("");

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("normal");
    setStatus("todo");
    setColor(DEFAULT_STAFF_COLOR);
    setTarget(assignedTo);
    setSubItems([]);
    setNewSub("");
  }, [assignedTo]);

  /** Předvyplnění při editaci, jinak čistý formulář */
  useEffect(() => {
    if (!open) return;
    if (!editing) {
      reset();
      return;
    }
    setTitle(editing.title);
    setDescription(editing.description ?? "");
    setDueDate(editing.due_date ?? "");
    setPriority(editing.priority);
    setStatus(editing.status);
    setColor(editing.color || DEFAULT_STAFF_COLOR);
    setTarget(editing.assigned_to);
    setNewSub("");
  }, [open, editing, reset]);

  /** Checklist existujícího úkolu */
  const loadSubItems = useCallback(async (taskId: string) => {
    const { data } = await supabase
      .from("staff_task_subitems")
      .select("id, title, is_done, sort_order")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true });
    setSubItems((data ?? []) as SubItem[]);
  }, []);

  useEffect(() => {
    if (!open || !editing) return;
    void loadSubItems(editing.id);
  }, [open, editing, loadSubItems]);

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

  const addSubItem = async () => {
    const t = newSub.trim();
    if (!t) return;
    if (!editing) {
      // Nový úkol – checklist se uloží až po vytvoření úkolu.
      setSubItems((prev) => [
        ...prev,
        { id: `tmp-${crypto.randomUUID()}`, title: t, is_done: false, sort_order: prev.length },
      ]);
      setNewSub("");
      return;
    }
    const { data, error } = await supabase
      .from("staff_task_subitems")
      .insert({ task_id: editing.id, title: t, sort_order: subItems.length })
      .select("id, title, is_done, sort_order")
      .single();
    if (error) {
      toast({ title: "Podúkol nelze přidat", description: error.message, variant: "destructive" });
      return;
    }
    setSubItems((prev) => [...prev, data as SubItem]);
    setNewSub("");
  };

  const toggleSubItem = async (item: SubItem) => {
    const next = !item.is_done;
    setSubItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, is_done: next } : s)));
    if (item.id.startsWith("tmp-")) return;
    const { error } = await supabase
      .from("staff_task_subitems")
      .update({ is_done: next })
      .eq("id", item.id);
    if (error) toast({ title: "Změnu nelze uložit", description: error.message, variant: "destructive" });
  };

  const removeSubItem = async (item: SubItem) => {
    setSubItems((prev) => prev.filter((s) => s.id !== item.id));
    if (item.id.startsWith("tmp-")) return;
    const { error } = await supabase.from("staff_task_subitems").delete().eq("id", item.id);
    if (error) toast({ title: "Podúkol nelze smazat", description: error.message, variant: "destructive" });
  };

  const save = async () => {
    const t = title.trim();
    if (!t) {
      toast({ title: "Zadejte název úkolu", variant: "destructive" });
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("staff_tasks")
        .update({
          title: t,
          description: description.trim() || null,
          assigned_to: target || editing.assigned_to,
          due_date: dueDate || null,
          priority,
          status,
          color,
          completed_at: status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast({ title: "Změny nelze uložit", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Úkol upraven" });
      onOpenChange(false);
      onCreated?.();
      return;
    }

    const { data, error } = await supabase
      .from("staff_tasks")
      .insert({
        title: t,
        description: description.trim() || null,
        assigned_to: target || assignedTo,
        assigned_by: assignedBy,
        due_date: dueDate || null,
        priority,
        color,
        status: "todo",
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast({ title: "Úkol nelze uložit", description: error?.message, variant: "destructive" });
      return;
    }

    if (subItems.length) {
      const { error: subError } = await supabase.from("staff_task_subitems").insert(
        subItems.map((s, i) => ({ task_id: data.id, title: s.title, is_done: s.is_done, sort_order: i })),
      );
      if (subError) {
        toast({ title: "Checklist nelze uložit", description: subError.message, variant: "destructive" });
      }
    }

    setSaving(false);
    toast({ title: "Úkol vytvořen" });
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Upravit úkol" : assigneeName ? `Přiřadit úkol — ${assigneeName}` : "Nový úkol"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(allowPickAssignee || editing) && (
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

          {editing && (
            <div className="space-y-1">
              <Label>Stav</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ColorSwatchPicker value={color} onChange={setColor} />

          <div className="space-y-2">
            <Label>Checklist</Label>
            {subItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Zatím žádné podúkoly.</p>
            ) : (
              <ul className="space-y-1">
                {subItems.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`sub-${s.id}`}
                      checked={s.is_done}
                      onCheckedChange={() => void toggleSubItem(s)}
                    />
                    <Label
                      htmlFor={`sub-${s.id}`}
                      className={`flex-1 cursor-pointer font-normal ${s.is_done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {s.title}
                    </Label>
                    <Button size="icon" variant="ghost" aria-label="Smazat podúkol" onClick={() => void removeSubItem(s)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={newSub}
                placeholder="Nový bod checklistu…"
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addSubItem();
                  }
                }}
              />
              <Button size="icon" variant="outline" aria-label="Přidat podúkol" onClick={() => void addSubItem()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button className="w-full" disabled={saving} onClick={() => void save()}>
            {saving ? "Ukládám…" : editing ? "Uložit změny" : "Vytvořit úkol"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StaffTaskDialog;
