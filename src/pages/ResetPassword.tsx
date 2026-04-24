import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
      setTimeout(() => navigate("/auth"), 3000);
    }
    setLoading(false);
  };

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
                <Input
                  id="newPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  placeholder="Minimálně 6 znaků"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Potvrdit heslo</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1"
                  placeholder="Zopakujte heslo"
                />
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
