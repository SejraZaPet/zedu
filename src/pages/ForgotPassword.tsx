import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, CheckCircle2 } from "lucide-react";

const GENERIC_MESSAGE =
  "Pokud e-mail existuje v systému, poslali jsme odkaz pro obnovení hesla.";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await supabase.functions.invoke("request-password-reset", {
        body: { email: email.trim() },
      });
    } catch {
      // swallow — always show generic message
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {!sent ? (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-heading text-2xl font-bold">Zapomenuté heslo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Zadejte váš e-mail a zašleme vám odkaz pro obnovení hesla.
              </p>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vas@email.cz"
                  className="mt-1"
                  required
                  autoComplete="email"
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Odesílám..." : "Poslat odkaz pro obnovení"}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/auth">← Zpět na přihlášení</Link>
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Zkontrolujte e-mail</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-6">{GENERIC_MESSAGE}</p>
            <p className="text-xs text-muted-foreground mb-6">
              Odkaz platí 1 hodinu. Nezapomeňte zkontrolovat i složku spam.
            </p>
            <Button asChild variant="outline">
              <Link to="/auth">Zpět na přihlášení</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
