import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TeacherRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Props {
  schoolId: string;
}

/** Seznam učitelů propojené školy + obsazenost míst z licence. */
const SchoolTeachersCard = ({ schoolId }: Props) => {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [seats, setSeats] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [profRes, licRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("school_id", schoolId)
          .order("last_name"),
        supabase
          .from("school_licenses")
          .select("seats_teachers")
          .eq("school_id", schoolId)
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const ids = (profRes.data ?? []).map((p: any) => p.id);
      let teacherIds = new Set<string>();
      if (ids.length) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids)
          .in("role", ["teacher", "lektor"]);
        teacherIds = new Set((roles ?? []).map((r: any) => r.user_id));
      }
      if (cancelled) return;
      setTeachers(((profRes.data as TeacherRow[]) ?? []).filter((p) => teacherIds.has(p.id)));
      setSeats((licRes.data as { seats_teachers: number | null } | null)?.seats_teachers ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return (
    <Card className="p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading">Učitelé této školy</h3>
        {seats !== null && (
          <Badge variant="outline">
            {teachers.length} z {seats} povolených míst obsazeno
          </Badge>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : teachers.length === 0 ? (
        <p className="text-sm text-muted-foreground">K této škole nejsou přiřazeni žádní učitelé.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {teachers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">
                {`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Bez jména"}
              </span>
              <span className="text-xs text-muted-foreground">{t.email ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default SchoolTeachersCard;
