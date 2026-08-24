import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Coins, Rocket, RefreshCw, Calculator, CheckCircle2, Users } from "lucide-react";

interface Settings {
  id: string;
  current_phase: string;
  founding_commission_percent: number;
  standard_commission_percent: number;
  founding_threshold_type: string;
  founding_threshold_value: number;
  founding_lock_years: number;
}

interface Metrics {
  active_schools: number;
  monthly_downloads: number;
  items_for_sale: number;
  active_subscriptions: number;
}

interface Earning {
  id: string;
  creator_id: string;
  period_month: string;
  source_type: string;
  amount: number;
  paid_out: boolean;
  paid_out_at: string | null;
}

const czk = (n: number) =>
  new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);

const firstOfMonth = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });

const MarketplaceEconomicsManager = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState(firstOfMonth());
  const [draft, setDraft] = useState<Partial<Settings>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: m }, { data: e }] = await Promise.all([
      supabase.from("marketplace_settings").select("*").order("created_at").limit(1).maybeSingle(),
      supabase.rpc("marketplace_phase_metrics"),
      supabase
        .from("creator_earnings")
        .select("*")
        .order("period_month", { ascending: false })
        .order("amount", { ascending: false }),
    ]);
    if (s) {
      setSettings(s as Settings);
      setDraft(s as Settings);
    }
    if (Array.isArray(m) && m[0]) setMetrics(m[0] as Metrics);
    const list = (e ?? []) as Earning[];
    setEarnings(list);

    const ids = [...new Set(list.map((x) => x.creator_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id;
      });
      setNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const periods = useMemo(() => {
    const set = new Set(earnings.map((e) => e.period_month));
    set.add(firstOfMonth());
    return [...set].sort().reverse();
  }, [earnings]);

  const filtered = useMemo(() => earnings.filter((e) => e.period_month === period), [earnings, period]);
  const periodTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const unpaidTotal = filtered.filter((e) => !e.paid_out).reduce((s, e) => s + Number(e.amount), 0);

  const isFounding = settings?.current_phase === "founding";
  const currentRate = isFounding
    ? settings?.founding_commission_percent
    : settings?.standard_commission_percent;

  const thresholdCurrent =
    settings?.founding_threshold_type === "monthly_downloads"
      ? metrics?.monthly_downloads ?? 0
      : metrics?.active_schools ?? 0;
  const thresholdPct = settings
    ? Math.min(100, Math.round((thresholdCurrent / Math.max(1, settings.founding_threshold_value)) * 100))
    : 0;

  const saveSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("marketplace_settings").update(patch).eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo" });
    void load();
  };

  const togglePhase = () =>
    saveSettings({ current_phase: isFounding ? "standard" : "founding" });

  const recalc = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("calculate_all_subscription_shares", {
      _period_month: period,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Výpočet selhal", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Výpočet dokončen",
      description: `Zapsáno ${data ?? 0} záznamů o výdělku za ${monthLabel(period)}.`,
    });
    void load();
  };

  const markPaid = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase
      .from("creator_earnings")
      .update({ paid_out: true, paid_out_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast({ title: "Nepodařilo se označit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Označeno jako vyplaceno" });
    void load();
  };

  if (loading) {
    return <p className="text-muted-foreground">Načítání ekonomiky BezliMarketu…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" /> Ekonomika BezliMarket
          </h2>
          <p className="text-sm text-muted-foreground">
            Provize tvůrcům, fáze sazeb a evidence výdělků. Skutečné platby se spustí až s platební bránou.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Obnovit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Aktuální fáze
            <Badge variant={isFounding ? "default" : "secondary"}>
              {isFounding ? "Zakladatelská" : "Standardní"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Provize Bezli z prodeje: <strong>{currentRate}&nbsp;%</strong> — tvůrci zůstává {100 - Number(currentRate ?? 0)} %.
            Sazba se tvůrci zamkne při prvním označení materiálu „na prodej“ a platí{" "}
            {settings?.founding_lock_years} let i po přechodu do standardní fáze.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Aktivní školy" value={String(metrics?.active_schools ?? 0)} />
            <Stat label="Stažení / 30 dní" value={String(metrics?.monthly_downloads ?? 0)} />
            <Stat label="Materiálů na prodej" value={String(metrics?.items_for_sale ?? 0)} />
            <Stat label="Aktivní předplatné" value={String(metrics?.active_subscriptions ?? 0)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Práh pro přechod do standardní fáze (
                {settings?.founding_threshold_type === "monthly_downloads" ? "stažení měsíčně" : "aktivní školy"})
              </span>
              <span className="font-medium">
                {thresholdCurrent} / {settings?.founding_threshold_value}
              </span>
            </div>
            <Progress value={thresholdPct} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Zakladatelská provize (%)">
              <Input
                type="number"
                value={draft.founding_commission_percent ?? ""}
                onChange={(ev) => setDraft((d) => ({ ...d, founding_commission_percent: Number(ev.target.value) }))}
              />
            </Field>
            <Field label="Standardní provize (%)">
              <Input
                type="number"
                value={draft.standard_commission_percent ?? ""}
                onChange={(ev) => setDraft((d) => ({ ...d, standard_commission_percent: Number(ev.target.value) }))}
              />
            </Field>
            <Field label="Uzamčení sazby (roky)">
              <Input
                type="number"
                value={draft.founding_lock_years ?? ""}
                onChange={(ev) => setDraft((d) => ({ ...d, founding_lock_years: Number(ev.target.value) }))}
              />
            </Field>
            <Field label="Typ prahu">
              <Select
                value={draft.founding_threshold_type ?? "active_schools"}
                onValueChange={(v) => setDraft((d) => ({ ...d, founding_threshold_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_schools">Aktivní školy</SelectItem>
                  <SelectItem value="monthly_downloads">Stažení měsíčně</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hodnota prahu">
              <Input
                type="number"
                value={draft.founding_threshold_value ?? ""}
                onChange={(ev) => setDraft((d) => ({ ...d, founding_threshold_value: Number(ev.target.value) }))}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                saveSettings({
                  founding_commission_percent: Number(draft.founding_commission_percent),
                  standard_commission_percent: Number(draft.standard_commission_percent),
                  founding_lock_years: Number(draft.founding_lock_years),
                  founding_threshold_type: String(draft.founding_threshold_type),
                  founding_threshold_value: Number(draft.founding_threshold_value),
                })
              }
            >
              Uložit nastavení
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={togglePhase}>
              Přepnout na {isFounding ? "standardní" : "zakladatelskou"} fázi
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fáze se nepřepíná automaticky — rozhoduje administrátor.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Výdělky tvůrců
          </CardTitle>
          <CardDescription>
            Podíl z předplatného se počítá váženě podle hloubky použití (přidání = 1, zadání třídě = 3, živá lekce = 5).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Období">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {monthLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button size="sm" variant="outline" disabled={saving} onClick={recalc}>
              <Calculator className="w-4 h-4 mr-1" /> Přepočítat podíly
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!filtered.some((e) => !e.paid_out)}
              onClick={() => markPaid(filtered.filter((e) => !e.paid_out).map((e) => e.id))}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Označit vše jako vyplacené
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Celkem za období" value={czk(periodTotal)} />
            <Stat label="K vyplacení" value={czk(unpaidTotal)} />
            <Stat label="Záznamů" value={String(filtered.length)} />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Za {monthLabel(period)} nejsou žádné výdělky. Spusťte přepočet, jakmile budou zaznamenaná data o použití.
            </p>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tvůrce</TableHead>
                    <TableHead>Zdroj</TableHead>
                    <TableHead className="text-right">Částka</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{names[e.creator_id] ?? e.creator_id}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.source_type === "direct_sale" ? "Přímý prodej" : "Podíl z předplatného"}
                      </TableCell>
                      <TableCell className="text-right">{czk(Number(e.amount))}</TableCell>
                      <TableCell>
                        <Badge variant={e.paid_out ? "secondary" : "outline"}>
                          {e.paid_out ? "Vyplaceno" : "Nevyplaceno"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!e.paid_out && (
                          <Button size="sm" variant="ghost" onClick={() => markPaid([e.id])}>
                            Označit vyplaceno
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-heading text-lg">{value}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default MarketplaceEconomicsManager;
