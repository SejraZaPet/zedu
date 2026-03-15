import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, KeyRound, User } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "Čeká na schválení",
  approved: "Schválený",
  blocked: "Zablokovaný",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
  status: string;
  created_at: string;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [school, setSchool] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [year, setYear] = useState<string>("");

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !user) {
      navigate("/auth?redirect=%2Fprofil");
      return;
    }

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        toast({ title: "Chyba", description: "Nepodařilo se načíst profil.", variant: "destructive" });
        setLoading(false);
        return;
      }

      setProfile({
        ...data,
        status: data.status as string,
      });
      setSchool(data.school || "");
      setFieldOfStudy(data.field_of_study || "");
      setYear(data.year ? String(data.year) : "");
      setLoading(false);
    };

    loadProfile();
  }, [authLoading, isLoggedIn, user, navigate, toast]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        school,
        field_of_study: fieldOfStudy,
        year: year ? parseInt(year, 10) : null,
      })
      .eq("id", session.user.id);

    setSaving(false);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Uloženo", description: "Údaje byly úspěšně aktualizovány." });
    setProfile((prev) => prev ? { ...prev, school, field_of_study: fieldOfStudy, year: year ? parseInt(year, 10) : null } : prev);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Chyba", description: "Heslo musí mít alespoň 6 znaků.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Chyba", description: "Hesla se neshodují.", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Hotovo", description: "Heslo bylo úspěšně změněno." });
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Načítání profilu...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto max-w-2xl flex items-center justify-between h-14 px-4">
          <h1 className="font-heading text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Můj profil
          </h1>
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Read-only info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Osobní údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Jméno</Label>
                <p className="font-medium">{profile.first_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Příjmení</Label>
                <p className="font-medium">{profile.last_name}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">E-mail</Label>
              <p className="font-medium text-muted-foreground">{profile.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Stav účtu</Label>
                <div className="mt-1">
                  <Badge variant="outline" className={`text-xs ${statusColors[profile.status] || ""}`}>
                    {statusLabels[profile.status] || profile.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Registrace</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(profile.created_at).toLocaleDateString("cs-CZ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editable fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Studijní údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="school">Škola</Label>
              <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="field">Obor</Label>
              <Input id="field" value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="year">Ročník</Label>
              <Input id="year" type="number" min={1} max={9} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Ukládání..." : "Uložit změny"}
            </Button>
          </CardContent>
        </Card>

        {/* Password change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zabezpečení</CardTitle>
          </CardHeader>
          <CardContent>
            {!showPasswordForm ? (
              <Button variant="outline" onClick={() => setShowPasswordForm(true)} className="gap-2">
                <KeyRound className="w-4 h-4" />
                Změnit heslo
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">Nové heslo</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimálně 6 znaků" />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Potvrzení hesla</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleChangePassword} disabled={changingPassword} className="gap-2">
                    <KeyRound className="w-4 h-4" />
                    {changingPassword ? "Měním..." : "Změnit heslo"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmPassword(""); }}>
                    Zrušit
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
