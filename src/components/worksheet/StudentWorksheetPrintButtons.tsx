import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { printStudentWorksheet } from "@/lib/worksheet-pdf-export";
import type { WorksheetSpec } from "@/lib/worksheet-spec";
import { toast } from "sonner";

interface Props {
  worksheetId: string;
  /** Pokud spec už máme, nenačítá se znovu. */
  spec?: WorksheetSpec | null;
  size?: "sm" | "default";
  compact?: boolean;
}

/** „Stáhnout PDF" a „Vytisknout" — vždy žákovská verze bez klíče a poznámek. */
export default function StudentWorksheetPrintButtons({ worksheetId, spec, size = "sm", compact }: Props) {
  const [busy, setBusy] = useState<"pdf" | "print" | null>(null);

  const run = async (kind: "pdf" | "print") => {
    setBusy(kind);
    try {
      let s = spec ?? null;
      if (!s) {
        const { data, error } = await supabase
          .from("worksheets" as any)
          .select("spec")
          .eq("id", worksheetId)
          .maybeSingle();
        if (error || !data) throw new Error("Pracovní list není dostupný.");
        s = (data as any).spec as WorksheetSpec;
      }
      if (kind === "pdf") toast.info("V okně tisku zvol „Uložit jako PDF“.");
      await printStudentWorksheet(s, worksheetId);
    } catch (e: any) {
      toast.error(e?.message || "Tisk se nepodařilo připravit.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button size={size} variant="ghost" onClick={() => run("pdf")} disabled={!!busy} title="Stáhnout PDF">
        {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {!compact && <span className="ml-1">Stáhnout PDF</span>}
      </Button>
      <Button size={size} variant="ghost" onClick={() => run("print")} disabled={!!busy} title="Vytisknout">
        {busy === "print" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        {!compact && <span className="ml-1">Vytisknout</span>}
      </Button>
    </>
  );
}
