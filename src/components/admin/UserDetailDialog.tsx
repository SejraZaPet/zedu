import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2, Save, Pencil } from "lucide-react";

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

const UserDetailDialog = ({ user, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
    school: "",
    year: "",
    field_of_study: "",
  });

  // Status & role still editable separately
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (user) {
      setEditData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        school: user.school || "",
        year: user.year ? String(user.year) : "",
        field_of_study: user.field_of_study || "",
      });
      setEditMode(false);
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

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: editData.first_name,
        last_name: editData.last_name,
        school: editData.school,
        year: editData.year ? parseInt(editData.year) : null,
        field_of_study: editData.field_of_study,
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    toast({ title: "Uloženo", description: "Profil byl aktualizován." });
    setEditMode(false);
    setSaving(false);
    onUpdated();
  };

  const handleSaveStatusRole = async () => {
    if (!user) return;
    setSaving(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ status: status as any })
      .eq("id", user.id);

    if (profileError) {
      toast({ title: "Chyba", description: profileError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (role !== user.role) {
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: role as any });

      if (roleError) {
        toast({ title: "Chyba při změně role", description: roleError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Uloženo", description: "Stav a role byly aktualizovány." });
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setDeleting(false);
      return;
    }
    await supabase.from("user_roles").delete().eq("user_id", user.id);
    toast({ title: "Smazáno", description: "Uživatel byl odstraněn." });
    setDeleting(false);
    onUpdated();
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Detail uživatele</DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditMode(!editMode)}
              className="mr-6"
            >
              {editMode ? (
                "Zrušit"
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Upravit
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Jméno</Label>
                  <Input
                    value={editData.first_name}
                    onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Příjmení</Label>
                  <Input
                    value={editData.last_name}
                    onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Škola</Label>
                <Input
                  value={editData.school}
                  onChange={(e) => setEditData({ ...editData, school: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ročník</Label>
                  <Input
                    value={editData.year}
                    onChange={(e) => setEditData({ ...editData, year: e.target.value })}
                    className="mt-1"
                    type="number"
                    min="1"
                    max="9"
                  />
                </div>
                <div>
                  <Label>Třída/Obor</Label>
                  <Input
                    value={editData.field_of_study}
                    onChange={(e) => setEditData({ ...editData, field_of_study: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveProfile} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? "Ukládání..." : "Uložit změny"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Jméno</div>
                  <div className="font-medium">{user.first_name || "–"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Příjmení</div>
                  <div className="font-medium">{user.last_name || "–"}</div>
                </div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">E-mail</div>
                <div className="font-medium break-all">{user.email}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Škola</div>
                <div className="font-medium">{user.school || "–"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Ročník</div>
                  <div className="font-medium">{user.year ?? "–"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Třída/Obor</div>
                  <div className="font-medium">{user.field_of_study || "–"}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Student</SelectItem>
                  <SelectItem value="rodic">Rodič</SelectItem>
                  <SelectItem value="teacher">Učitel</SelectItem>
                  <SelectItem value="school_admin">Správce školy</SelectItem>
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

          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
          <Button onClick={handleSaveStatusRole} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Ukládání..." : "Uložit role/stav"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailDialog;
