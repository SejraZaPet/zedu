import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { STAFF_MODULES } from "@/lib/staff-modules";
import { UserCog } from "lucide-react";

type PedRole = "none" | "teacher" | "lektor";

interface StaffMember {
  id: string;
  position: string | null;
  initials: string | null;
  active: boolean;
  private_email: string | null;
  work_email: string | null;
  phone: string | null;
}

interface PermRow {
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

interface Props {
  userId: string;
}

/** Pracovní (interní) role uživatele + oprávnění k modulům administrace. Jen pro adminy. */
const UserStaffRoleSection = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [perms, setPerms] = useState<Record<string, PermRow>>({});
  const [position, setPosition] = useState("");
  const [initials, setInitials] = useState("");
  const [privateEmail, setPrivateEmail] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [pedRole, setPedRole] = useState<PedRole>("none");
  const [savingPed, setSavingPed] = useState(false);

  const loadPedRole = async (profileId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", profileId);
    const roles = (data ?? []).map((r) => r.role as string);
    setPedRole(roles.includes("teacher") ? "teacher" : roles.includes("lektor") ? "lektor" : "none");
  };

  const savePedRole = async (value: PedRole) => {
    setSavingPed(true);
    const prev = pedRole;
    setPedRole(value);
    // Odebereme jen pedagogické role, ostatní (admin, rodic, …) necháváme.
    const { error: delError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", ["teacher", "lektor"]);
    if (delError) {
      setPedRole(prev);
      setSavingPed(false);
      toast({ title: "Uložení pedagogické role selhalo", description: delError.message, variant: "destructive" });
      return;
    }
    if (value !== "none") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: value });
      if (error) {
        setSavingPed(false);
        await loadPedRole(userId);
        toast({ title: "Uložení pedagogické role selhalo", description: error.message, variant: "destructive" });
        return;
      }
    }
    setSavingPed(false);
    toast({
      title:
        value === "none"
          ? "Pedagogická role odebrána (čistě administrativní účet)"
          : `Pedagogická role nastavena: ${value === "teacher" ? "Učitel" : "Lektor"}`,
    });
  };

  const loadPerms = async (staffId: string) => {
    const { data } = await supabase
      .from("staff_permissions")
      .select("module, can_view, can_edit")
      .eq("staff_member_id", staffId);
    const map: Record<string, PermRow> = {};
    (data ?? []).forEach((p) => { map[p.module] = p as PermRow; });
    setPerms(map);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("staff_members")
        .select("id, position, initials, active, private_email, work_email, phone")
        .eq("profile_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const s = (data as StaffMember | null) ?? null;
      setStaff(s);
      setPosition(s?.position ?? "");
      setInitials(s?.initials ?? "");
      setPrivateEmail(s?.private_email ?? "");
      setWorkEmail(s?.work_email ?? "");
      setPhone(s?.phone ?? "");
      setPerms({});
      if (s) await loadPerms(s.id);
      await loadPedRole(userId);
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  const toggleInternal = async (value: boolean) => {
    setSaving(true);
    if (staff) {
      const { error } = await supabase.from("staff_members").update({ active: value }).eq("id", staff.id);
      if (error) toast({ title: "Uložení selhalo", description: error.message, variant: "destructive" });
      else setStaff({ ...staff, active: value });
    } else if (value) {
      const { data, error } = await supabase
        .from("staff_members")
        .insert({ profile_id: userId, position: position.trim() || null, active: true })
        .select("id, position, initials, active, private_email, work_email, phone")
        .maybeSingle();
      if (error) toast({ title: "Nepodařilo se vytvořit pracovní roli", description: error.message, variant: "destructive" });
      else setStaff((data as StaffMember) ?? null);
    }
    setSaving(false);
  };

  const saveDetails = async () => {
    if (!staff) return;
    setSaving(true);
    const payload = {
      position: position.trim() || null,
      initials: initials.trim().toUpperCase() || null,
      private_email: privateEmail.trim() || null,
      work_email: workEmail.trim() || null,
      phone: phone.trim() || null,
    };
    const { error } = await supabase.from("staff_members").update(payload).eq("id", staff.id);
    setSaving(false);
    if (error) {
      toast({ title: "Uložení selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setStaff({ ...staff, ...payload });
    toast({ title: "Pracovní role uložena" });
  };

  const setPerm = async (module: string, field: "can_view" | "can_edit", value: boolean) => {
    if (!staff) return;
    const current = perms[module] ?? { module, can_view: false, can_edit: false };
    const next = { ...current, [field]: value };
    if (field === "can_edit" && value) next.can_view = true;
    if (field === "can_view" && !value) next.can_edit = false;
    setPerms((p) => ({ ...p, [module]: next }));
    const { error } = await supabase
      .from("staff_permissions")
      .upsert(
        { staff_member_id: staff.id, module, can_view: next.can_view, can_edit: next.can_edit },
        { onConflict: "staff_member_id,module" },
      );
    if (error) toast({ title: "Uložení oprávnění selhalo", description: error.message, variant: "destructive" });
  };

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Nastavit pracovní roli</span>
        </div>
        <Switch
          checked={!!staff?.active}
          disabled={loading || saving}
          onCheckedChange={(v) => void toggleInternal(v)}
          aria-label="Interní pracovník"
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Načítání…</p>
      ) : staff?.active ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pozice</Label>
              <Input className="mt-1" placeholder="Obchodník, Podpora…" value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <div>
              <Label>Zkratka</Label>
              <Input
                className="mt-1"
                maxLength={4}
                placeholder="např. KH"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input className="mt-1" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div>
              <Label>Pracovní e-mail</Label>
              <Input className="mt-1" type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} />
            </div>
            <div>
              <Label>Soukromý e-mail</Label>
              <Input className="mt-1" type="email" value={privateEmail} onChange={(e) => setPrivateEmail(e.target.value)} />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={saveDetails} disabled={saving}>
            {saving ? "Ukládám…" : "Uložit pracovní údaje"}
          </Button>

          <div>
            <p className="text-sm font-medium mb-2">Oprávnění k modulům</p>
            <div className="grid grid-cols-[1fr_auto_auto] gap-y-2 gap-x-6 items-center text-sm">
              <span className="text-xs text-muted-foreground">Modul</span>
              <span className="text-xs text-muted-foreground">Zobrazit</span>
              <span className="text-xs text-muted-foreground">Upravit</span>
              {STAFF_MODULES.map((m) => {
                const p = perms[m.id];
                return (
                  <div key={m.id} className="contents">
                    <span>{m.label}</span>
                    <Checkbox checked={!!p?.can_view} onCheckedChange={(v) => void setPerm(m.id, "can_view", !!v)} />
                    <Checkbox checked={!!p?.can_edit} onCheckedChange={(v) => void setPerm(m.id, "can_edit", !!v)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Zapnutím vytvoříte pracovní roli s přístupem do administrace podle nastavených modulů.
        </p>
      )}
    </div>
  );
};

export default UserStaffRoleSection;
