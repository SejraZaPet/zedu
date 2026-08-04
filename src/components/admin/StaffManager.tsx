import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, UserCog } from "lucide-react";
import { STAFF_MODULES } from "@/lib/staff-modules";

interface StaffRow {
  id: string;
  profile_id: string;
  position: string | null;
  active: boolean;
  hired_at: string | null;
  private_email: string | null;
  work_email: string | null;
  phone: string | null;
  profile?: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface PermRow {
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

const fullName = (s: StaffRow) =>
  [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(" ") || s.profile?.email || "Bez jména";

const StaffManager = () => {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<StaffRow | null>(null);
  const [perms, setPerms] = useState<Record<string, PermRow>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [emailQuery, setEmailQuery] = useState("");
  const [position, setPosition] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("staff_members")
      .select("id, profile_id, position, active, hired_at, private_email, work_email, phone, profile:profiles!staff_members_profile_id_fkey(first_name, last_name, email)")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Nepodařilo se načíst zaměstnance", description: error.message, variant: "destructive" });
    setStaff((data as unknown as StaffRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (s: StaffRow) => {
    setDetail(s);
    const { data } = await supabase
      .from("staff_permissions")
      .select("module, can_view, can_edit")
      .eq("staff_member_id", s.id);
    const map: Record<string, PermRow> = {};
    (data ?? []).forEach((p) => { map[p.module] = p as PermRow; });
    setPerms(map);
  };

  const setPerm = async (module: string, field: "can_view" | "can_edit", value: boolean) => {
    if (!detail) return;
    const current = perms[module] ?? { module, can_view: false, can_edit: false };
    const next = { ...current, [field]: value };
    if (field === "can_edit" && value) next.can_view = true;
    if (field === "can_view" && !value) next.can_edit = false;
    setPerms((p) => ({ ...p, [module]: next }));
    const { error } = await supabase
      .from("staff_permissions")
      .upsert(
        { staff_member_id: detail.id, module, can_view: next.can_view, can_edit: next.can_edit },
        { onConflict: "staff_member_id,module" },
      );
    if (error) toast({ title: "Uložení oprávnění selhalo", description: error.message, variant: "destructive" });
  };

  const addStaff = async () => {
    const email = emailQuery.trim().toLowerCase();
    if (!email) return;
    const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!profile) {
      toast({ title: "Uživatel s tímto e-mailem nebyl nalezen", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("staff_members").insert({
      profile_id: profile.id,
      position: position.trim() || null,
    });
    if (error) {
      toast({ title: "Nepodařilo se přidat zaměstnance", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Zaměstnanec přidán" });
    setAddOpen(false);
    setEmailQuery("");
    setPosition("");
    load();
  };

  const toggleActive = async (s: StaffRow) => {
    await supabase.from("staff_members").update({ active: !s.active }).eq("id", s.id);
    load();
    if (detail?.id === s.id) setDetail({ ...s, active: !s.active });
  };

  if (detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setDetail(null); load(); }}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na seznam
        </Button>
        <Card className="p-5 space-y-1">
          <h2 className="font-heading text-xl">{fullName(detail)}</h2>
          <p className="text-sm text-muted-foreground">
            {detail.position || "Bez pozice"} · {detail.active ? "Aktivní" : "Neaktivní"}
          </p>
          <div className="pt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleActive(detail)}>
              {detail.active ? "Deaktivovat" : "Aktivovat"}
            </Button>
          </div>
        </Card>

        <StaffContactCard staff={detail} onSaved={(updated) => { setDetail(updated); load(); }} />



        <Card className="p-5">
          <h3 className="font-heading mb-3">Oprávnění k modulům</h3>
          <div className="grid grid-cols-[1fr_auto_auto] gap-y-2 gap-x-6 items-center text-sm">
            <span className="text-xs text-muted-foreground">Modul</span>
            <span className="text-xs text-muted-foreground">Zobrazit</span>
            <span className="text-xs text-muted-foreground">Upravit</span>
            {STAFF_MODULES.map((m) => {
              const p = perms[m.id];
              return (
                <div key={m.id} className="contents">
                  <span>{m.label}</span>
                  <Checkbox checked={!!p?.can_view} onCheckedChange={(v) => setPerm(m.id, "can_view", !!v)} />
                  <Checkbox checked={!!p?.can_edit} onCheckedChange={(v) => setPerm(m.id, "can_edit", !!v)} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl">Zaměstnanci</h2>
          <p className="text-sm text-muted-foreground">Přístupy do administrace podle modulů</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Přidat zaměstnance
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : staff.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Zatím žádní zaměstnanci.</Card>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-accent/40" onClick={() => openDetail(s)}>
              <div className="flex items-center gap-3 min-w-0">
                <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{fullName(s)}</p>
                  <p className="text-xs text-muted-foreground">{s.position || "Bez pozice"}</p>
                </div>
              </div>
              <Badge variant={s.active ? "default" : "outline"}>{s.active ? "Aktivní" : "Neaktivní"}</Badge>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Přidat zaměstnance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail existujícího uživatele *</Label>
              <Input type="email" value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} />
            </div>
            <div>
              <Label>Pozice</Label>
              <Input placeholder="Obchodník, Podpora…" value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Zrušit</Button>
            <Button onClick={addStaff}>Přidat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManager;
