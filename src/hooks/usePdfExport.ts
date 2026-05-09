import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

export type PdfDocType = "worksheet" | "lesson_plan" | "schedule";

export function usePdfExport() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function exportOne(type: PdfDocType, id: string): Promise<string | null> {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: { type, id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("PDF se nepodařilo vygenerovat (chybí URL).");
      logAudit("pdf_generated", type, id, { batch: false });
      window.open(url, "_blank", "noopener,noreferrer");
      toast({ title: "PDF vygenerováno", description: "Otevírám stažené PDF v novém panelu." });
      return url;
    } catch (e: any) {
      toast({
        title: "PDF se nepodařilo vygenerovat",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function exportBatch(type: PdfDocType, ids: string[]): Promise<string | null> {
    if (ids.length === 0) return null;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-batch", {
        body: { type, ids },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("ZIP se nepodařilo vygenerovat.");
      logAudit("pdf_generated", type, null as any, { batch: true, count: ids.length });
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: `Vygenerováno ${ids.length} PDF`,
        description: "Stahuji ZIP archiv v novém panelu.",
      });
      return url;
    } catch (e: any) {
      toast({
        title: "Hromadné PDF se nepodařilo vygenerovat",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, exportOne, exportBatch };
}
