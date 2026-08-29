import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Check, Clock, X } from "lucide-react";
import {
  fetchPendingReservations,
  hhmm,
  reserverLabel,
  setReservationStatus,
  type ResourceReservation,
  type SchoolResource,
} from "@/lib/school-resources";

/** Přehled čekajících žádostí o rezervaci u položek, které vyžadují schválení. */
export default function PendingReservationsCard({ resources }: { resources: SchoolResource[] }) {
  const approvalIds = useMemo(
    () => resources.filter((r) => r.requires_approval).map((r) => r.id),
    [resources],
  );
  const byId = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const [rows, setRows] = useState<ResourceReservation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchPendingReservations(approvalIds));
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  }, [approvalIds]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (r: ResourceReservation, status: "confirmed" | "rejected") => {
    setBusy(r.id);
    try {
      await setReservationStatus(r.id, status);
      toast({ title: status === "confirmed" ? "Rezervace schválena" : "Rezervace zamítnuta" });
      void load();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (approvalIds.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" /> Žádosti ke schválení
        </CardTitle>
        <Badge variant={rows.length ? "default" : "secondary"}>{rows.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné čekající žádosti.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {byId.get(r.resource_id)?.name ?? "Položka"} ·{" "}
                  {new Date(r.date + "T00:00:00").toLocaleDateString("cs-CZ")} {hhmm(r.time_from)}–
                  {hhmm(r.time_to)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reserverLabel(r)}
                  {r.quantity > 1 ? ` · ${r.quantity} ks` : ""}
                  {r.purpose_note ? ` · ${r.purpose_note}` : ""}
                  {r.recurrence_group_id ? " · z rozvrhu (série)" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, "confirmed")}>
                  <Check className="mr-1 h-4 w-4" /> Schválit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => decide(r, "rejected")}
                >
                  <X className="mr-1 h-4 w-4" /> Zamítnout
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
