import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck } from "lucide-react";

interface TeacherRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

/**
 * Karta pro školního admina: udělení práv „vedení školy“ vybraným učitelům.
 * Vedení může upravovat zápisy z porad a kontrolovat přidělené a splněné úkoly.
 */
const SchoolLeadershipCard = ({ schoolId }: { schoolId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [delegates, setDelegates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, dRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("school_id", schoolId)
        .order("last_name", { ascending: true }),
      supabase.from("school_leadership_delegates").select("user_id").eq("school_id", schoolId),
    ]);
    // Jen pedagogové (učitelé / lektoři) — ověříme přes user_roles
    const ids = ((tRes.data ?? []) as TeacherRow[]).map((t) => t.id);
    let pedagogIds = new Set<string>(ids);
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids)
        .in("role", ["teacher", "lektor"]);
      pedagogIds = new Set((roles ?? []).map((r) => r.user_id as string));
    }
    setTeachers(((tRes.data ?? []) as TeacherRow[]).filter((t) => pedagogIds.has(t.id)));
    setDelegates(new Set((dRes.data ?? []).map((d) => d.user_id as string)));
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (teacherId: string, value: boolean) => {
    setSavingId(teacherId);
    if (value) {
      const { error } = await supabase
        .from("school_leadership_delegates")
        .insert({ school_id: schoolId, user_id: teacherId, granted_by: user?.id ?? null });
      if (error) {
        setSavingId(null);
        toast({ title: "Udělení práv selhalo", description: error.message, variant: "destructive" });
        return;
      }
      setDelegates((prev) => new Set(prev).add(teacherId));
    } else {
      const { error } = await supabase
        .from("school_leadership_delegates")
        .delete()
        .eq("school_id", schoolId)
        .eq("user_id", teacherId);
      if (error) {
        setSavingId(null);
        toast({ title: "Odebrání práv selhalo", description: error.message, variant: "destructive" });
        return;
      }
      setDelegates((prev) => {
        const next = new Set(prev);
        next.delete(teacherId);
        return next;
      });
    }
    setSavingId(null);
    toast({ title: value ? "Práva vedení udělena" : "Práva vedení odebrána" });
  };

  const nameOf = (t: TeacherRow) =>
    [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || t.email || "Učitel";

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Práva vedení školy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Učitelé s právy vedení mohou upravovat a mazat zápisy z porad, přidělovat úkoly kolegům
          a kontrolovat, kdo přidělené úkoly splnil.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Načítání…</p>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ve škole nejsou žádní učitelé.</p>
        ) : (
          <div className="space-y-2">
            {teachers.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 text-sm border border-border rounded-lg px-3 py-2"
              >
                <span>
                  {nameOf(t)}
                  {t.id === user?.id && <span className="text-xs text-muted-foreground"> (vy)</span>}
                </span>
                <Switch
                  checked={delegates.has(t.id)}
                  disabled={savingId === t.id}
                  onCheckedChange={(v) => void toggle(t.id, v)}
                  aria-label={`Práva vedení pro ${nameOf(t)}`}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolLeadershipCard;
