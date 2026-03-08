import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Save } from "lucide-react";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
  status: string;
  created_at: string;
  role?: string;
}

interface Props {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const statusLabels: Record<string, string> = {
  pending: "Čeká na schválení",
  approved: "Schválený",
  blocked: "Zablokovaný",
};

const UserDetailDialog = ({ user, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [school, setSchool] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setSchool(user.school);
      setFieldOfStudy(user.field_of_study);
      setYear(user.year ? String(user.year) : "");
      setStatus(user.status);
      setRole(user.role || "user");
      setLastSignIn(null);
      fetchAuthInfo(user.id);
    }
  }, [user]);

  const fetchAuthInfo = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-user-auth-info", {
        body: { user_id: userId },
      });
      if (!error && data?.last_sign_in_at) {
        setLastSignIn(data.last_sign_in_at);
      }
    } catch {
      // silently fail
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        school,
        field_of_study: fieldOfStudy,
        year: year ? parseInt(year) : null,
        status: status as any,
      })
      .eq("id", user.id);

    if (profileError) {
      toast({ title: "Chyba", description: profileError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Update role if changed
    if (role !== user.role) {
      // Delete existing role
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      // Insert new role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: role as any });

      if (roleError) {
        toast({ title: "Chyba při změně role", description: roleError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Uloženo", description: "Údaje uživatele byly aktualizovány." });
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);

    // Delete profile (cascade should handle user_roles via FK)
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setDeleting(false);
      return;
    }

    // Also delete role entries
    await supabase.from("user_roles").delete().eq("user_id", user.id);

    toast({ title: "Smazáno", description: "Uživatel byl odstraněn." });
    setDeleting(false);
    onUpdated();
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail uživatele</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jméno</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Příjmení</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>E-mail</Label>
            <Input value={user.email} disabled className="mt-1 opacity-60" />
            <p className="text-xs text-muted-foreground mt-1">E-mail nelze změnit.</p>
          </div>

          <div>
            <Label>Škola</Label>
            <Input value={school} onChange={(e) => setSchool(e.target.value)} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Obor</Label>
              <Input value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Ročník</Label>
              <Input type="number" min="1" max="6" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stav účtu</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Čeká na schválení</SelectItem>
                  <SelectItem value="approved">Schválený</SelectItem>
                  <SelectItem value="blocked">Zablokovaný</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Read-only info */}
          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Registrace:</span>
              <span>{new Date(user.created_at).toLocaleString("cs-CZ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Poslední přihlášení:</span>
              <span>{lastSignIn ? new Date(lastSignIn).toLocaleString("cs-CZ") : "–"}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="mr-auto">
                <Trash2 className="w-4 h-4 mr-1" /> Smazat uživatele
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Opravdu smazat uživatele?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce je nevratná. Profil uživatele {user.first_name} {user.last_name} bude trvale odstraněn.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Mazání..." : "Smazat"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Ukládání..." : "Uložit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailDialog;
