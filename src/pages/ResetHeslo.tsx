import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetHeslo = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const token = (params.get("token") || "").trim();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      setError("Odkaz je neplatný nebo vypršel.");
    }
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Chyba", description: "Heslo musí mít alespoň 6 znaků.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Chyba", description: "Hesla se neshodují.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "confirm-password-reset",
        { body: { token, new_password: password } }
      );
      if (fnErr) {
        const msg = (data as any)?.error || "Odkaz je neplatný nebo vypršel.";
        setError(msg);
      } else {
        setDone(true);
        toast({ title: "Heslo bylo změněno", description: "Nyní se můžete přihlásit novým heslem." });
        setTimeout(() => navigate("/auth", { replace: true }), 2500);
      }
    } catch {
      setError("Došlo k chybě. Zkuste to prosím znovu.");
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Neplatný odkaz</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">{error}</p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/zapomenute-heslo">Vyžádat nový odkaz</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/auth">Zpět na přihlášení</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Heslo změněno!</h1>
          <p className="text-sm text-muted-foreground mt-2">Budete přesměrováni na přihlášení...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Nastavit nové heslo</h1>
          <p className="text-sm text-muted-foreground mt-1">Zadejte své nové heslo.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="newPassword">Nové heslo</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 pr-10"
                placeholder="Minimálně 6 znaků"
                minLength={6}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Potvrdit heslo</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 pr-10"
                placeholder="Zopakujte heslo"
                minLength={6}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Ukládám..." : "Uložit nové heslo"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetHeslo;
