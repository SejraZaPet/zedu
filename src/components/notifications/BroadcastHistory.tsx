import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface Broadcast {
  id: string;
  sender_id: string;
  sender_role: string;
  receiver_type: string;
  receiver_ids: string[];
  title: string;
  content: string;
  type: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
  error_message: string | null;
}

interface Props {
  /** If true, only own broadcasts (teacher view). RLS handles it anyway. */
  scope: "all" | "own";
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Naplánováno", color: "#f59e0b" },
  sent: { label: "Odesláno", color: "#16a34a" },
  cancelled: { label: "Zrušeno", color: "#6b7280" },
  failed: { label: "Selhalo", color: "#dc2626" },
};

const RECEIVER_LABELS: Record<string, string> = {
  all: "Všichni",
  all_teachers: "Všichni učitelé",
  all_students: "Všichni žáci",
  class: "Třída",
  user: "Konkrétní žáci",
  group: "Skupina",
};

const TYPE_LABELS: Record<string, string> = {
  reminder: "Připomenutí",
  message: "Zpráva",
  warning: "Upozornění",
  info: "Informace",
  update: "Novinka",
};

export default function BroadcastHistory({ scope }: Props) {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_broadcasts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Načtení historie selhalo");
      setLoading(false);
      return;
    }
    setItems(((data ?? []) as unknown) as Broadcast[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("cancel_notification" as any, { _broadcast_id: id });
    if (error) {
      toast.error("Zrušení selhalo: " + error.message);
      return;
    }
    toast.success("Notifikace zrušena");
    fetchAll();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-semibold">Historie notifikací</h3>
        <Button variant="ghost" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Obnovit
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Načítání…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {scope === "own" ? "Zatím jste neodeslal/a žádnou notifikaci." : "Zatím žádné odeslané notifikace."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Vytvořeno</th>
                <th className="py-2 pr-3 font-medium">Název</th>
                <th className="py-2 pr-3 font-medium">Typ</th>
                <th className="py-2 pr-3 font-medium">Cíl</th>
                <th className="py-2 pr-3 font-medium">Stav</th>
                <th className="py-2 pr-3 font-medium">Příjemců</th>
                <th className="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const s = STATUS_LABELS[b.status] ?? { label: b.status, color: "#6b7280" };
                return (
                  <tr key={b.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(b.created_at), "d.M.yyyy HH:mm", { locale: cs })}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{b.title}</div>
                      {b.content && (
                        <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">{b.content}</div>
                      )}
                      {b.scheduled_at && b.status === "scheduled" && (
                        <div className="text-xs text-amber-600 mt-1">
                          Odeslat: {format(new Date(b.scheduled_at), "d.M.yyyy HH:mm", { locale: cs })}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">{TYPE_LABELS[b.type] ?? b.type}</td>
                    <td className="py-2 pr-3">{RECEIVER_LABELS[b.receiver_type] ?? b.receiver_type}</td>
                    <td className="py-2 pr-3">
                      <Badge style={{ background: s.color + "1a", color: s.color, border: `1px solid ${s.color}40` }}>
                        {s.label}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{b.recipient_count}</td>
                    <td className="py-2 pr-3">
                      {b.status === "scheduled" && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(b.id)} title="Zrušit">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
