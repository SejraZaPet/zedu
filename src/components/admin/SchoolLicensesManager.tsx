import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PLAN_LABELS, PLAN_DEFAULTS, STATUS_LABELS, type LicensePlan, type LicenseStatus, type SchoolLicense, isExpired } from "@/lib/school-licenses";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRM_TYPES, statusMeta } from "@/lib/staff-modules";

interface SchoolRow {
  id: string;
  name: string;
  license: SchoolLicense | null;
  teachers_used: number;
  students_used: number;
}

interface PendingOrgRow {
  id: string;
  name: string;
  type: string;
  region: string | null;
  status: string;
  linked_school_id: string | null;
}

const fmtSeats = (used: number, seats: number | null) =>
  seats === null ? `${used} / ∞` : `${used} / ${seats}`;

const SchoolLicensesManager = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [pending, setPending] = useState<PendingOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SchoolRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [schoolsRes, licRes, usageRes, orgsRes] = await Promise.all([
      supabase.from("schools").select("id, name").order("name"),
      supabase.from("school_licenses").select("*"),
      supabase.rpc("school_license_usage_all"),
      supabase
        .from("crm_organizations")
        .select("id, name, type, region, status, linked_school_id")
        .in("status", ["zkusebni", "zakaznik"])
        .order("name"),
    ]);
    if (schoolsRes.error) {
      toast({ title: "Chyba", description: schoolsRes.error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const licBy = new Map<string, SchoolLicense>();
    (licRes.data ?? []).forEach((l: any) => licBy.set(l.school_id, l as SchoolLicense));
    const useBy = new Map<string, { t: number; s: number }>();
    (usageRes.data ?? []).forEach((u: any) => useBy.set(u.school_id, { t: u.teachers_used, s: u.students_used }));

    setRows(
      (schoolsRes.data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        license: licBy.get(s.id) ?? null,
        teachers_used: useBy.get(s.id)?.t ?? 0,
        students_used: useBy.get(s.id)?.s ?? 0,
      }))
    );
    setPending((orgsRes.data as PendingOrgRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spolupracující organizace</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">Načítání…</p>
        ) : (
          <Tabs defaultValue="schools">
            <TabsList className="mb-4">
              <TabsTrigger value="schools">Školy s licencí ({rows.length})</TabsTrigger>
              <TabsTrigger value="crm">Zkušební / zákazníci z CRM ({pending.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="schools">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Škola</TableHead>
                    <TableHead>Balíček</TableHead>
                    <TableHead>Učitelé</TableHead>
                    <TableHead>Žáci</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Expirace</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const l = r.license;
                    const over =
                      l &&
                      ((l.seats_teachers !== null && r.teachers_used > l.seats_teachers) ||
                        (l.seats_students !== null && r.students_used > l.seats_students));
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{l ? PLAN_LABELS[l.plan] : <span className="text-muted-foreground">Bez licence</span>}</TableCell>
                        <TableCell className={over ? "text-destructive" : ""}>
                          {l ? fmtSeats(r.teachers_used, l.seats_teachers) : r.teachers_used}
                        </TableCell>
                        <TableCell className={over ? "text-destructive" : ""}>
                          {l ? fmtSeats(r.students_used, l.seats_students) : r.students_used}
                        </TableCell>
                        <TableCell>
                          {l ? (
                            <Badge variant={isExpired(l) ? "destructive" : l.status === "active" ? "default" : "secondary"}>
                              {STATUS_LABELS[l.status]}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{l?.expires_at ? new Date(l.expires_at).toLocaleDateString("cs-CZ") : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                            {l ? "Upravit" : "Vytvořit"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="crm">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné organizace ve stavu zkušební nebo zákazník.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organizace</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Stav v CRM</TableHead>
                      <TableHead>Napojení na účet</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{CRM_TYPES.find((t) => t.value === o.type)?.label ?? o.type}</TableCell>
                        <TableCell>{o.region || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" style={{ borderColor: statusMeta(o.status).color, color: statusMeta(o.status).color }}>
                            {statusMeta(o.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {o.linked_school_id
                            ? <Badge variant="default">Propojeno se školou</Badge>
                            : <Badge variant="secondary">Čeká na propojení</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/admin?tab=crm&org=${o.id}`}>CRM detail</a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        )}
        <EditDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
      </CardContent>
    </Card>
  );
};

const EditDialog = ({ row, onClose, onSaved }: { row: SchoolRow | null; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [plan, setPlan] = useState<LicensePlan>("start");
  const [status, setStatus] = useState<LicenseStatus>("trial");
  const [seatsTeachers, setSeatsTeachers] = useState<string>("");
  const [seatsStudents, setSeatsStudents] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [billing, setBilling] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const l = row.license;
    if (l) {
      setPlan(l.plan);
      setStatus(l.status);
      setSeatsTeachers(l.seats_teachers?.toString() ?? "");
      setSeatsStudents(l.seats_students?.toString() ?? "");
      setExpiresAt(l.expires_at ? l.expires_at.slice(0, 10) : "");
      setBilling(l.billing_cycle ?? "none");
      setNotes(l.admin_notes ?? "");
    } else {
      setPlan("start");
      setStatus("trial");
      const d = PLAN_DEFAULTS.start;
      setSeatsTeachers(d.seats_teachers?.toString() ?? "");
      setSeatsStudents(d.seats_students?.toString() ?? "");
      setExpiresAt("");
      setBilling("none");
      setNotes("");
    }
  }, [row]);

  const applyPlanDefaults = (p: LicensePlan) => {
    setPlan(p);
    const d = PLAN_DEFAULTS[p];
    setSeatsTeachers(d.seats_teachers?.toString() ?? "");
    setSeatsStudents(d.seats_students?.toString() ?? "");
  };

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const payload = {
      school_id: row.id,
      plan,
      status,
      seats_teachers: seatsTeachers.trim() === "" ? null : Number(seatsTeachers),
      seats_students: seatsStudents.trim() === "" ? null : Number(seatsStudents),
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      billing_cycle: billing === "none" ? null : billing,
      admin_notes: notes.trim() || null,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    };
    const q = row.license
      ? supabase.from("school_licenses").update(payload).eq("id", row.license.id)
      : supabase.from("school_licenses").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: "Chyba uložení", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo" });
    onSaved();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row?.name ?? ""} — licence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Balíček</Label>
              <Select value={plan} onValueChange={(v) => applyPlanDefaults(v as LicensePlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLAN_LABELS) as LicensePlan[]).map(k => (
                    <SelectItem key={k} value={k}>{PLAN_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stav</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LicenseStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as LicenseStatus[]).map(k => (
                    <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Míst — učitelé (prázdné = ∞)</Label>
              <Input type="number" value={seatsTeachers} onChange={e => setSeatsTeachers(e.target.value)} />
            </div>
            <div>
              <Label>Míst — žáci (prázdné = ∞)</Label>
              <Input type="number" value={seatsStudents} onChange={e => setSeatsStudents(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expirace</Label>
              <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <div>
              <Label>Fakturace</Label>
              <Select value={billing} onValueChange={setBilling}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="monthly">Měsíčně</SelectItem>
                  <SelectItem value="yearly">Ročně</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Interní poznámky</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Zrušit</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Ukládám…" : "Uložit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchoolLicensesManager;
