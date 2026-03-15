import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const StudentGameJoin = () => {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [userName, setUserName] = useState("");
  const [joining, setJoining] = useState(false);
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) setUserName(`${data.first_name} ${data.last_name}`.trim());
      });
  }, [user]);

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return;
    const playerName = isLoggedIn ? userName : nickname.trim();
    if (!playerName) {
      toast({ title: "Zadejte přezdívku", variant: "destructive" });
      return;
    }

    setJoining(true);
    try {
      // Call secure join-game edge function
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      const { data, error } = await supabase.functions.invoke("join-game", {
        body: { gameCode: trimmedCode, nickname: playerName },
      });

      if (error || data?.error) {
        const msg = data?.error || error?.message || "Nepodařilo se připojit";
        toast({ title: msg, variant: "destructive" });
        setJoining(false);
        return;
      }

      // Store join token in sessionStorage (not URL)
      sessionStorage.setItem(`game_token_${data.sessionId}`, data.joinToken);
      sessionStorage.setItem(`game_player_${data.sessionId}`, data.playerId);

      navigate(`/hra/hrac/${data.sessionId}`);
    } catch {
      toast({ title: "Chyba při připojování", variant: "destructive" });
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center pt-[70px] px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Gamepad2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Připojit se do hry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Kód hry</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Např. ABC123"
                className="text-center text-2xl font-mono tracking-[0.3em] h-14"
                maxLength={6}
              />
            </div>
            {!isLoggedIn && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Vaše přezdívka</label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Např. Jakub"
                  maxLength={20}
                />
              </div>
            )}
            {isLoggedIn && userName && (
              <p className="text-sm text-muted-foreground text-center">
                Připojíte se jako <span className="font-semibold text-foreground">{userName}</span>
              </p>
            )}
            <Button
              onClick={handleJoin}
              disabled={joining || !code.trim() || (!isLoggedIn && !nickname.trim())}
              className="w-full"
              size="lg"
              variant="hero"
            >
              {joining ? "Připojování..." : "Připojit se"}
            </Button>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentGameJoin;
