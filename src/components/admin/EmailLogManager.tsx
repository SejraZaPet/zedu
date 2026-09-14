import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send } from "lucide-react";

type EmailLogRow = {
  id: string;
  recipient: string;
  subject: string;
  email_type: string;
  status: string;
  error_message: string | null;
  html: string | null;
  body_text: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  welcome: "Přístupové údaje",
  password_reset: "Obnovení hesla",
  license_expiring: "Blížící se konec licence",
  crm_bulk: "Hromadný e-mail",
  parent_notification: "Zpráva rodiči",
  certificate: "Certifikát",
  other: "Ostatní",
};

const statusBadge = (status: string) => {
  if (status === "sent") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Odesláno</Badge>;
  if (status === "failed") return <Badge variant="destructive">Selhalo</Badge>;
  return <Badge variant="secondary">Čeká</Badge>;
};

const EmailLogManager = () => {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("email_log")
      .select("id, recipient, subject, email_type, status, error_message, html, body_text, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query;
    if (error) {
      toast.error("Přehled e-mailů se nepodařilo načíst");
    } else {
      setRows((data ?? []) as EmailLogRow[]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const resend = async (row: EmailLogRow) => {
    if (!row.html && !row.body_text) {
      toast.error("U tohoto e-mailu není uložený obsah, nelze jej poslat znovu.");
      return;
    }
    setResendingId(row.id);
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to: row.recipient.split(",").map((r) => r.trim()).filter(Boolean),
        subject: row.subject,
        html: row.html ?? undefined,
        text: row.body_text ?? undefined,
        emailType: row.email_type,
      },
    });
    setResendingId(null);
    if (error) {
      toast.error("Opakované odeslání selhalo");
    } else {
      toast.success("E-mail byl odeslán znovu");
    }
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Odeslané e-maily</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stav" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="sent">Odesláno</SelectItem>
              <SelectItem value="failed">Selhalo</SelectItem>
              <SelectItem value="pending">Čeká</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Obnovit">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-muted-foreground">Zatím tu nejsou žádné záznamy o odeslaných e-mailech.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Datum</th>
                  <th className="py-2 pr-3 font-medium">Příjemce</th>
                  <th className="py-2 pr-3 font-medium">Typ</th>
                  <th className="py-2 pr-3 font-medium">Předmět</th>
                  <th className="py-2 pr-3 font-medium">Stav</th>
                  <th className="py-2 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3">
                      {new Date(row.created_at).toLocaleString("cs-CZ")}
                    </td>
                    <td className="py-2 pr-3 break-all">{row.recipient}</td>
                    <td className="py-2 pr-3">{TYPE_LABELS[row.email_type] ?? row.email_type}</td>
                    <td className="py-2 pr-3">
                      {row.subject}
                      {row.status === "failed" && row.error_message && (
                        <p className="mt-1 text-xs text-destructive">{row.error_message}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3">{statusBadge(row.status)}</td>
                    <td className="py-2">
                      {row.status !== "sent" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resendingId === row.id}
                          onClick={() => void resend(row)}
                        >
                          {resendingId === row.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-3 w-3" />
                          )}
                          Odeslat znovu
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailLogManager;
