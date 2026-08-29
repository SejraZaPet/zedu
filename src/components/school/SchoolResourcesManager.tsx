import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, DoorOpen, Package } from "lucide-react";
import { useSchoolResources } from "@/hooks/useSchoolResources";
import {
  CONDITION_LABELS,
  RESOURCE_TYPE_LABELS,
  resourcePlaceLabel,
  type ConditionStatus,
  type ResourceType,
  type SchoolResource,
} from "@/lib/school-resources";

const ALL = "__all__";

interface FormState {
  type: ResourceType;
  name: string;
  description: string;
  building: string;
  floor: string;
  room_number: string;
  total_quantity: string;
  location_note: string;
  condition_status: ConditionStatus;
  buffer_minutes: string;
}

const emptyForm = (type: ResourceType = "room"): FormState => ({
  type,
  name: "",
  description: "",
  building: "",
  floor: "",
  room_number: "",
  total_quantity: "1",
  location_note: "",
  condition_status: "ok",
  buffer_minutes: "0",
});

/** Správa místností a inventáře školy (jen pro administrátora). */
export default function SchoolResourcesManager({ schoolId }: { schoolId: string }) {
  const { user } = useAuth();
  const { resources, loading, refetch } = useSchoolResources(schoolId);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [buildingFilter, setBuildingFilter] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolResource | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const buildings = useMemo(
    () => Array.from(new Set(resources.map((r) => r.building).filter(Boolean) as string[])).sort(),
    [resources],
  );

  const filtered = useMemo(
    () =>
      resources.filter(
        (r) =>
          (typeFilter === ALL || r.type === typeFilter) &&
          (buildingFilter === ALL || r.building === buildingFilter),
      ),
    [resources, typeFilter, buildingFilter],
  );

  const openNew = (type: ResourceType) => {
    setEditing(null);
    setForm(emptyForm(type));
    setOpen(true);
  };

  const openEdit = (r: SchoolResource) => {
    setEditing(r);
    setForm({
      type: r.type,
      name: r.name,
      description: r.description ?? "",
      building: r.building ?? "",
      floor: r.floor ?? "",
      room_number: r.room_number ?? "",
      total_quantity: String(r.total_quantity ?? 1),
      location_note: r.location_note ?? "",
      condition_status: r.condition_status,
      buffer_minutes: String(r.buffer_minutes ?? 0),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Doplňte název položky.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      school_id: schoolId,
      type: form.type,
      name: form.name.trim(),
      description: form.description.trim() || null,
      building: form.type === "room" ? form.building.trim() || null : null,
      floor: form.type === "room" ? form.floor.trim() || null : null,
      room_number: form.type === "room" ? form.room_number.trim() || null : null,
      total_quantity: form.type === "inventory" ? Math.max(Number(form.total_quantity) || 1, 1) : 1,
      location_note: form.type === "inventory" ? form.location_note.trim() || null : null,
      condition_status: form.condition_status,
      buffer_minutes: Math.max(Number(form.buffer_minutes) || 0, 0),
      created_by: user?.id ?? null,
    };
    const { error } = editing
      ? await supabase.from("school_resources" as any).update(payload as any).eq("id", editing.id)
      : await supabase.from("school_resources" as any).insert(payload as any);
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Uloženo" : "Položka přidána" });
    setOpen(false);
    void refetch();
  };

  const remove = async (r: SchoolResource) => {
    if (!confirm(`Smazat „${r.name}“ včetně jejích rezervací?`)) return;
    const { error } = await supabase.from("school_resources" as any).delete().eq("id", r.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Smazáno" });
    void refetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Místnosti a inventář</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Vše</SelectItem>
              <SelectItem value="room">Místnosti</SelectItem>
              <SelectItem value="inventory">Inventář</SelectItem>
            </SelectContent>
          </Select>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Budova" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Všechny budovy</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b} value={b}>
                  Budova {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => openNew("room")}>
            <DoorOpen className="mr-1 h-4 w-4" /> Místnost
          </Button>
          <Button size="sm" onClick={() => openNew("inventory")}>
            <Plus className="mr-1 h-4 w-4" /> Inventář
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Načítání…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím nejsou žádné položky. Přidejte místnost nebo inventář.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Umístění</TableHead>
                <TableHead>Počet</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.type === "room" ? (
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        {r.name}
                        {r.description && (
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{RESOURCE_TYPE_LABELS[r.type]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {resourcePlaceLabel(r) || "—"}
                  </TableCell>
                  <TableCell>{r.type === "inventory" ? `${r.total_quantity} ks` : "—"}</TableCell>
                  <TableCell>
                    {r.type === "inventory" ? (
                      <Badge variant={r.condition_status === "ok" ? "secondary" : "destructive"}>
                        {CONDITION_LABELS[r.condition_status]}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Upravit položku" : form.type === "room" ? "Nová místnost" : "Nový inventář"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Typ</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as ResourceType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Místnost</SelectItem>
                  <SelectItem value="inventory">Inventář</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Název</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={form.type === "room" ? "Učebna fyziky" : "Tablet iPad"}
              />
            </div>
            <div>
              <Label>Krátký popis</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {form.type === "room" ? (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Budova</Label>
                  <Input
                    value={form.building}
                    onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
                    placeholder="A"
                  />
                </div>
                <div>
                  <Label>Patro</Label>
                  <Input
                    value={form.floor}
                    onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label>Označení</Label>
                  <Input
                    value={form.room_number}
                    onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))}
                    placeholder="A203"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Celkem kusů</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.total_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, total_quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Kde se vyzvedává</Label>
                  <Input
                    value={form.location_note}
                    onChange={(e) => setForm((f) => ({ ...f, location_note: e.target.value }))}
                    placeholder="Kabinet A201"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {form.type === "inventory" && (
                <div>
                  <Label>Stav</Label>
                  <Select
                    value={form.condition_status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, condition_status: v as ConditionStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONDITION_LABELS) as ConditionStatus[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {CONDITION_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Ochranná pauza (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.buffer_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, buffer_minutes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
