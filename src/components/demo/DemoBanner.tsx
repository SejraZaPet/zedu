import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Copy, Check, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoPair } from "@/lib/demo";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEMO_SAVE_OFFERED_KEY, demoCountdownText, demoExtendedText, extendDemoOnce, formatDemoLastDay, hasOwnDemoContent, showCountdown, useDemoStatus,
} from "@/lib/demo-contact-client";
import DemoSaveWorkDialog from "./DemoSaveWorkDialog";

/**
 * Trvalý oranžový pruh nahoře — jen pro uživatele demo dvojice.
 * Svou výšku publikuje v --demo-banner-h, podle které se posune pevná hlavička i obsah.
 */
const DemoBanner = () => {
  const pair = useDemoPair();
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { status, reload } = useDemoStatus(!!pair);
  const [saveOpen, setSaveOpen] = useState(false);
  const [extendMsg, setExtendMsg] = useState<string | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);

  // Nabídnout „Uložit moji práci“ jednou po prvním vlastním obsahu (jen učitel, bez uloženého e-mailu).
  useEffect(() => {
    if (!pair || pair.side !== "teacher" || !user || !status || status.hasContact) return;
    try { if (window.localStorage.getItem(DEMO_SAVE_OFFERED_KEY)) return; } catch { return; }
    let cancelled = false;
    hasOwnDemoContent(user.id).then((has) => {
      if (cancelled || !has) return;
      try { window.localStorage.setItem(DEMO_SAVE_OFFERED_KEY, "1"); } catch { /* ignore */ }
      setSaveOpen(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pair, user, status, pathname]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!pair || !ref.current) {
      root.style.removeProperty("--demo-banner-h");
      document.body.style.removeProperty("padding-top");
      return;
    }
    const el = ref.current;
    const apply = () => {
      const h = `${el.offsetHeight}px`;
      root.style.setProperty("--demo-banner-h", h);
      document.body.style.paddingTop = h;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--demo-banner-h");
      document.body.style.removeProperty("padding-top");
    };
  }, [pair]);

  if (!pair) return null;

  const extend = async () => {
    setExtendBusy(true); setExtendMsg(null);
    try { await extendDemoOnce(); await reload(); }
    catch (e) { setExtendMsg((e as Error).message); }
    finally { setExtendBusy(false); }
  };
  const countdown = showCountdown(status?.daysLeft);
  const deleteDay = status?.deletesAt ? formatDemoLastDay(status.deletesAt).replace(/\.$/, "") : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pair.returnCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Testovací účet"
      className="fixed top-0 inset-x-0 z-[60] bg-demo text-demo-foreground shadow-md"
    >
      <div className="container mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <FlaskConical className="w-4 h-4 shrink-0" aria-hidden />
          TESTOVACÍ ÚČET – nevkládejte osobní údaje. Data se po 14 dnech bez aktivity smažou.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-90">Zapiš si ho, s ním se vrátíš na jiném zařízení:</span>
          <code className="rounded bg-demo-foreground/15 px-2 py-0.5 font-mono font-bold tracking-wide">{pair.returnCode}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={copy}
            className="h-7 px-2 text-demo-foreground hover:bg-demo-foreground/15 hover:text-demo-foreground"
            aria-label="Kopírovat návratový kód"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? "Zkopírováno" : "Kopírovat"}
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSaveOpen(true)}
          className="h-7 px-2 text-demo-foreground hover:bg-demo-foreground/15 hover:text-demo-foreground underline underline-offset-2"
        >
          Uložit moji práci
        </Button>
        <Button
          asChild
          size="sm"
          className="ml-auto h-7 bg-demo-foreground text-demo hover:bg-demo-foreground/90"
        >
          <Link to="/licence">Chci Bezli pro svou školu</Link>
        </Button>
      </div>
      {status?.deletesAt && (
        <div className={`border-t border-demo-foreground/20 ${countdown ? "bg-demo-foreground/10" : ""}`}>
          <div className="container mx-auto px-4 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <p role="status" aria-live="polite" className={countdown ? "font-semibold" : ""}>
              {demoCountdownText(status.daysLeft ?? 0, deleteDay)}
              {status.extended && deleteDay ? ` ${demoExtendedText(deleteDay)}` : ""}
            </p>
            {!status.extended && (
              <Button size="sm" onClick={extend} disabled={extendBusy}
                className="h-8 min-w-[44px] bg-demo-foreground text-demo hover:bg-demo-foreground/90">
                {extendBusy ? "Prodlužuji…" : "Prodloužit o 14 dní"}
              </Button>
            )}
            {countdown && (
              <Button size="sm" variant="ghost" onClick={() => setSaveOpen(true)}
                className="h-8 px-2 text-demo-foreground hover:bg-demo-foreground/15 hover:text-demo-foreground">Stáhnout práci</Button>
            )}
            {extendMsg && <p role="alert" className="font-semibold">{extendMsg}</p>}
          </div>
        </div>
      )}
      <DemoSaveWorkDialog open={saveOpen} onOpenChange={setSaveOpen} status={status} onChanged={reload} />
    </div>
  );
};

export default DemoBanner;
