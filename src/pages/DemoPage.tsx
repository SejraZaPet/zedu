import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, Presentation, KeyRound, ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_CODE_KEY, DEMO_RETRYING_MSG, DemoCallError, dashboardFor, restoreDemo, startDemo, useDemoPair, type DemoCallOptions } from "@/lib/demo";
import logo from "@/assets/bezli-logo.png";

const DemoPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const pair = useDemoPair();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const eventTag = params.get("akce");

  useEffect(() => {
    document.title = "Vyzkoušej Bezli – demo";
    try { setSavedCode(window.localStorage.getItem(DEMO_CODE_KEY)); } catch { /* ignore */ }
  }, []);

  const [retrying, setRetrying] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  // Synchronní zámek: druhé ťuknutí před překreslením (disabled) nevyvolá druhé založení.
  const lockRef = useRef(false);
  const lastRef = useRef<{ key: string; fn: (o: DemoCallOptions) => Promise<"teacher" | "student"> } | null>(null);

  const go = async (key: string, fn: (o: DemoCallOptions) => Promise<"teacher" | "student">) => {
    if (lockRef.current) return;
    lockRef.current = true;
    lastRef.current = { key, fn };
    setBusy(key);
    setError(null);
    setCanRetry(false);
    setRetrying(false);
    try {
      const role = await fn({ onRetry: () => setRetrying(true) });
      window.location.assign(dashboardFor(role));
    } catch (e) {
      setRetrying(false);
      setError((e as Error).message || "Spojení se nepovedlo. Zkontrolujte připojení a klepněte znovu.");
      setCanRetry(e instanceof DemoCallError && e.kind === "network");
      setBusy(null);
      lockRef.current = false;
    }
  };

  const canContinue = (isLoggedIn && pair) || (!isLoggedIn && savedCode);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img src={logo} alt="Bezli" className="h-10 w-auto mx-auto" />
          <h1 className="font-heading text-3xl font-bold">Vyzkoušej Bezli</h1>
          <p className="inline-flex items-center gap-2 rounded-full bg-demo/15 px-3 py-1 text-sm font-medium text-foreground">
            <FlaskConical className="w-4 h-4" aria-hidden /> Demo, bez registrace
          </p>
        </div>

        {canContinue && (
          <Button
            variant="outline"
            className="w-full h-12 gap-2"
            disabled={!!busy}
            onClick={() =>
              isLoggedIn && pair
                ? navigate(dashboardFor(pair.side))
                : go("continue", (o) => restoreDemo(savedCode!, o))
            }
          >
            Pokračovat tam, kde jsem skončil/a <ArrowRight className="w-4 h-4" />
          </Button>
        )}

        <div className="grid gap-3">
          <Button
            size="lg"
            className="h-16 text-lg gap-3"
            disabled={!!busy}
            onClick={() => go("teacher", (o) => startDemo("teacher", eventTag, o))}
          >
            <Presentation className="w-6 h-6" aria-hidden />
            {busy === "teacher" ? "Připravuji…" : "Vstoupit jako učitel"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-16 text-lg gap-3"
            disabled={!!busy}
            onClick={() => go("student", (o) => startDemo("student", eventTag, o))}
          >
            <GraduationCap className="w-6 h-6" aria-hidden />
            {busy === "student" ? "Připravuji…" : "Vstoupit jako žák"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Vstupem do dema souhlasíte s{" "}
          <a href="/podminky" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">obchodními podmínkami (čl. 7)</a>
          {" "}a{" "}
          <a href="/gdpr" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">zásadami ochrany osobních údajů</a>.
        </p>

        {retrying && busy && (
          <p role="status" className="text-sm text-muted-foreground text-center">{DEMO_RETRYING_MSG}</p>
        )}
        {error && (
          <div className="space-y-2 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {canRetry && lastRef.current && (
              <Button
                variant="outline"
                className="h-11 min-w-40"
                disabled={!!busy}
                onClick={() => { const l = lastRef.current; if (l) void go(l.key, l.fn); }}
              >
                Zkusit znovu
              </Button>
            )}
          </div>
        )}

        <div className="text-center">
          {!showCode ? (
            <button type="button" className="text-sm text-primary underline underline-offset-4" onClick={() => setShowCode(true)}>
              Mám návratový kód
            </button>
          ) : (
            <form
              className="space-y-2 text-left"
              onSubmit={(e) => { e.preventDefault(); if (code.trim()) go("code", (o) => restoreDemo(code, o)); }}
            >
              <Label htmlFor="demo-code">Návratový kód</Label>
              <div className="flex gap-2">
                <Input
                  id="demo-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="např. KOCKA-LOUKA-REKA-47"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <Button type="submit" disabled={!!busy || !code.trim()} className="gap-1">
                  <KeyRound className="w-4 h-4" aria-hidden /> Vstoupit
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};

export default DemoPage;
