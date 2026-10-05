import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { dashboardFor, switchDemo, useDemoPair } from "@/lib/demo";

/** Přepínač Učitel ↔ Žák v záhlaví — jen pro demo účty; vymění relaci za druhý účet z dvojice. */
const DemoRoleSwitch = ({ className }: { className?: string }) => {
  const pair = useDemoPair();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!pair) return null;

  const current = pair.side === "teacher" ? "Učitel" : "Žák";
  const other = pair.side === "teacher" ? "Žák" : "Učitel";

  const run = async () => {
    setBusy(true);
    try {
      const role = await switchDemo();
      window.location.assign(dashboardFor(role));
    } catch (e) {
      toast({ title: "Přepnutí se nepovedlo", description: (e as Error).message, variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={run}
      className={`gap-2 border-demo text-foreground ${className ?? ""}`}
      aria-label={`Teď jste ${current}. Přepnout na ${other}`}
    >
      <span className="font-semibold">{current}</span>
      <ArrowLeftRight className="w-4 h-4" aria-hidden />
      <span className="text-muted-foreground">{other}</span>
    </Button>
  );
};

export default DemoRoleSwitch;
