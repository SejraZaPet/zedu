import { useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEMO_CONSENT_TEXT, deleteDemoContact, normalizeDemoEmail, saveDemoContact, type DemoStatus,
} from "@/lib/demo-contact-client";
import {
  buildDemoExportZip, DEMO_EXPORT_CATEGORIES, DemoExportTooLarge, exportLimitMessage, type DemoExportCategory,
} from "@/lib/demo-export";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  status: DemoStatus | null;
  onChanged: () => void;
}

const DemoSaveWorkDialog = ({ open, onOpenChange, status, onChanged }: Props) => {
  const { user } = useAuth();
  const ids = { email: useId(), consent: useId(), msg: useId() };
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);
  const [perCategory, setPerCategory] = useState(false);

  const save = async () => {
    setMsg(null);
    if (!normalizeDemoEmail(email)) return setMsg("Zadejte prosím platný e-mail.");
    if (!consent) return setMsg("Bez souhlasu e-mail uložit nemůžeme.");
    setBusy(true);
    try { await saveDemoContact(email); setEmail(""); setConsent(false); setMsg("E-mail jsme uložili. Před smazáním vám pošleme připomínku a po něm jednu závěrečnou zprávu; poté e-mail smažeme."); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setMsg(null);
    try { await deleteDemoContact(); setMsg("Váš e-mail jsme smazali."); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  const runExport = async (cats: DemoExportCategory[], label: string) => {
    if (!user) return;
    setExporting(label); setReady(null); setMsg(null);
    try {
      const blob = await buildDemoExportZip(user.id, cats);
      setReady({ blob, name: `bezli-moje-prace${cats.length === 1 ? `-${cats[0]}` : ""}.zip` });
    } catch (e) {
      if (e instanceof DemoExportTooLarge) { setPerCategory(true); setMsg(exportLimitMessage(e.reason)); }
      else setMsg((e as Error).message || "Export se nepodařil.");
    } finally { setExporting(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-y-auto sm:max-w-lg"
        style={{ top: "calc(50% + var(--demo-banner-h, 0px) / 2)", maxHeight: "calc(92vh - var(--demo-banner-h, 0px))" }}
      >
        <DialogHeader>
          <DialogTitle>Uložit moji práci</DialogTitle>
          <DialogDescription>
            Demo se po 14 dnech bez aktivity smaže. Můžete si nechat poslat připomínku nebo práci stáhnout.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby={`${ids.email}-h`} className="space-y-3">
          <h3 id={`${ids.email}-h`} className="font-semibold">Připomínka e-mailem (nepovinné)</h3>
          {status?.hasContact ? (
            <div className="space-y-2">
              <p className="text-sm">Připomínky posíláme na <strong>{status.emailMasked}</strong>.</p>
              <Button variant="outline" onClick={remove} disabled={busy} className="w-full sm:w-auto">Smazat můj e-mail</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor={ids.email}>Váš e-mail</Label>
                <Input id={ids.email} type="email" autoComplete="email" inputMode="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} aria-describedby={msg ? ids.msg : undefined} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id={ids.consent} checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-1" />
                <Label htmlFor={ids.consent} className="text-sm font-normal leading-snug">{DEMO_CONSENT_TEXT}</Label>
              </div>
              <Button onClick={save} disabled={busy} className="w-full sm:w-auto">Uložit e-mail</Button>
            </div>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-4" aria-label="Stáhnout moji práci">
          <h3 className="font-semibold">Stáhnout moji práci</h3>
          <p className="text-sm text-muted-foreground">ZIP s daty (JSON), listy k tisku do PDF a vašimi soubory. Bez dat žáků. Nejvýš 200 položek a 50 MB.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="secondary" disabled={!!exporting}
              onClick={() => runExport(DEMO_EXPORT_CATEGORIES.map((c) => c.id), "vše")}>
              {exporting === "vše" ? "Připravuji…" : "Připravit vše"}
            </Button>
            {!perCategory && (
              <Button variant="ghost" onClick={() => setPerCategory(true)}>Po kategoriích</Button>
            )}
          </div>
          {perCategory && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_EXPORT_CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Button variant="outline" className="w-full" disabled={!!exporting} onClick={() => runExport([c.id], c.label)}>
                    {exporting === c.label ? "Připravuji…" : c.label}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {ready && (
            <Button onClick={() => downloadBlob(ready.blob, ready.name)} className="w-full sm:w-auto">
              Stáhnout ZIP ({Math.max(1, Math.round(ready.blob.size / 1024))} kB)
            </Button>
          )}
        </section>

        <p id={ids.msg} role="status" aria-live="polite" className="text-sm min-h-5">{msg}</p>
      </DialogContent>
    </Dialog>
  );
};

export default DemoSaveWorkDialog;
