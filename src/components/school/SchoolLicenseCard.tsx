import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { PLAN_LABELS, STATUS_LABELS, isExpired, type SchoolLicense } from "@/lib/school-licenses";

interface Props { schoolId: string }

const SchoolLicenseCard = ({ schoolId }: Props) => {
  const [license, setLicense] = useState<SchoolLicense | null>(null);
  const [usage, setUsage] = useState<{ t: number; s: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [licRes, useRes] = await Promise.all([
        supabase.from("school_licenses").select("*").eq("school_id", schoolId).maybeSingle(),
        supabase.rpc("school_license_usage", { _school_id: schoolId }),
      ]);
      if (!mounted) return;
      setLicense((licRes.data as SchoolLicense | null) ?? null);
      const u = useRes.data?.[0];
      setUsage(u ? { t: u.teachers_used, s: u.students_used } : { t: 0, s: 0 });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [schoolId]);

  if (loading) return <Card><CardContent className="py-6 text-muted-foreground">Načítání licence…</CardContent></Card>;

  if (!license) {
    return (
      <Card>
        <CardHeader><CardTitle>Licence</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">Vaše škola zatím nemá přiřazený licenční balíček.</p>
          <Button asChild><Link to="/licence"><ExternalLink className="w-4 h-4 mr-1" /> Zobrazit balíčky</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const overT = license.seats_teachers !== null && (usage?.t ?? 0) > license.seats_teachers;
  const overS = license.seats_students !== null && (usage?.s ?? 0) > license.seats_students;
  const expired = isExpired(license);

  const pct = (used: number, seats: number | null) => {
    if (seats === null || seats === 0) return 0;
    return Math.min(100, Math.round((used / seats) * 100));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Licence: {PLAN_LABELS[license.plan]}</CardTitle>
        <Badge variant={expired ? "destructive" : license.status === "active" ? "default" : "secondary"}>
          {STATUS_LABELS[license.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {(overT || overS || expired) && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              {expired && <div>Platnost licence vypršela. Prosím kontaktujte nás pro obnovení.</div>}
              {(overT || overS) && (
                <div>
                  Překročili jste kapacitu balíčku <strong>{PLAN_LABELS[license.plan]}</strong>. Zvažte upgrade.
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Učitelé</span>
            <span className={overT ? "text-destructive font-medium" : ""}>
              {usage?.t ?? 0} / {license.seats_teachers ?? "∞"}
            </span>
          </div>
          <Progress value={pct(usage?.t ?? 0, license.seats_teachers)} />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Aktivní žáci</span>
            <span className={overS ? "text-destructive font-medium" : ""}>
              {usage?.s ?? 0} / {license.seats_students ?? "∞"}
            </span>
          </div>
          <Progress value={pct(usage?.s ?? 0, license.seats_students)} />
        </div>

        <div className="text-sm text-muted-foreground">
          {license.expires_at
            ? <>Platnost do: <strong>{new Date(license.expires_at).toLocaleDateString("cs-CZ")}</strong></>
            : "Bez data expirace"}
        </div>

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline"><Link to="/licence">Zobrazit balíčky</Link></Button>
          <Button asChild><a href="mailto:info@Bezli.cz?subject=Upgrade%20licence%20Bezli">Chci upgradovat</a></Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchoolLicenseCard;
