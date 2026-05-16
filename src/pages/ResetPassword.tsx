import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Supabase's recovery flow places tokens in the URL hash (#access_token=...&type=recovery)
    // and the client auto-establishes a session. We listen for PASSWORD_RECOVERY,
    // and also fall back to checking the existing session.
    const hash = window.location.hash || "";
    const hashHasError = hash.includes("error=") || hash.includes("error_code=");
    const hashHasRecovery = hash.includes("type=recovery") || hash.includes("access_token=");

    if (hashHasError) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const desc = params.get("error_description") || params.get("error") || "Odkaz pro obnovu hesla je neplatný nebo vypršel.";
      setLinkError(decodeURIComponent(desc.replace(/\+/g, " ")));
      setValidLink(false);
      setChecking(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidLink(true);
        setChecking(false);
      }
    });

    // Fallback: if we already have a session and arrived via recovery hash, allow reset.
    // Otherwise, after a short grace period, redirect to /auth.
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && hashHasRecovery) {
        setValidLink(true);
        setChecking(false);
      } else {
        setLinkError("Odkaz pro obnovu hesla je neplatný nebo vypršel. Vyžádejte si prosím nový.");
        setValidLink(false);
        setChecking(false);
        setTimeout(() => navigate("/auth", { replace: true }), 3500);
      }
    }, 1200);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);


  const handleReset = async () => {
    if (password.length < 6) {
      toast({ title: "Chyba", description: "Heslo musí mít alespoň 6 znaků.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Chyba", description: "Hesla se neshodují.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        await supabase.from("profiles").update({ login_password: password }).eq("id", userId);
      }
      setDone(true);
      setTimeout(() => navigate("/auth"), 3000);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Ověřuji odkaz pro obnovu hesla...</p>
      </div>
    );
  }

  if (!validLink) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Neplatný odkaz</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            {linkError || "Odkaz pro obnovu hesla je neplatný nebo vypršel."}
          </p>
          <p className="text-xs text-muted-foreground mb-4">Za chvíli vás přesměrujeme na přihlášení.</p>
          <Button onClick={() => navigate("/auth", { replace: true })}>Zpět na přihlášení</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {!done ? (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-heading text-2xl font-bold">Nové heslo</h1>
              <p className="text-sm text-muted-foreground mt-1">Zadejte své nové heslo.</p>
            </div>
            <div className="space-y-4">
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
              <Button className="w-full" onClick={handleReset} disabled={loading}>
                {loading ? "Ukládám..." : "Uložit nové heslo"}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Heslo změněno!</h1>
            <p className="text-sm text-muted-foreground mt-2">Budete přesměrováni na přihlášení...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
