import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";

type Row = {
  id: string; created_at: string; name: string | null; email: string | null; phone: string | null;
  organization: string | null; role: string | null; plan: string | null; student_count: string | null;
  message: string | null; consent_accepted_at: string | null; consent_terms_version: string | null;
  email_status: string; handled_status: string;
};

const EMAIL_LABEL: Record<string, string> = { sent: "E-mail odeslán", failed: "E-mail selhal", pending: "E-mail čeká" };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" }) : "—");

/** Poptávky licencí – jen čtení, jen pro admina (RLS is_admin). */
export default function LicenseInquiriesList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from("license_inquiries")
      .select("id, created_at, name, email, phone, organization, role, plan, student_count, message, consent_accepted_at, consent_terms_version, email_status, handled_status")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);
    if (error) setError("Poptávky se nepodařilo načíst.");
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Poptávky licencí</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-label="Obnovit seznam">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!loading && !error && rows.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné poptávky.</p>}
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.name || "—"}</span>
                {r.plan && <Badge variant="secondary">{r.plan}</Badge>}
                <Badge variant={r.email_status === "failed" ? "destructive" : "outline"}>{EMAIL_LABEL[r.email_status] ?? r.email_status}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{fmt(r.created_at)}</span>
              </div>
              <p className="mt-1 break-words text-muted-foreground">
                {[r.email, r.phone, r.organization, r.role, r.student_count && `${r.student_count} žáků`].filter(Boolean).join(" · ")}
              </p>
              {r.message && <p className="mt-1 whitespace-pre-wrap break-words">{r.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                Souhlas s podmínkami: {r.consent_accepted_at ? `${fmt(r.consent_accepted_at)}, verze ${r.consent_terms_version ?? "—"}` : "nezaznamenán"}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
