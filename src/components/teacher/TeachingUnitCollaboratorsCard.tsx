import { BetaBadge } from "@/components/common/BetaBadge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Search } from "lucide-react";

interface Props {
  /** UUID předmětu z katalogu `subjects` (bez něj nelze spolupráci navázat). */
  subjectId: string | null;
  classId?: string;
  groupId?: string;
}

interface CollaboratorRow {
  id: string;
  invited_teacher_id: string;
  invited_by: string;
  name: string;
  email: string | null;
}

interface CandidateRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const fullName = (p: { first_name?: string | null; last_name?: string | null }) =>
  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Bez jména";

/**
 * Spoluučitelé konkrétní Výuky (předmět + třída nebo skupina).
 * Pozvat lze pouze učitele ze stejné školy — server (trigger v databázi)
 * to ověřuje znovu, UI jen nabízí správné kandidáty.
 */
const TeachingUnitCollaboratorsCard = ({ subjectId, classId, groupId }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [rows, setRows] = useState<CollaboratorRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user || !subjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [profRes, collabRes] = await Promise.all([
      supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle(),
      (groupId
        ? supabase
            .from("teaching_unit_collaborators")
            .select("id, invited_teacher_id, invited_by")
            .eq("subject_id", subjectId)
            .eq("group_id", groupId)
        : supabase
            .from("teaching_unit_collaborators")
            .select("id, invited_teacher_id, invited_by")
            .eq("subject_id", subjectId)
            .eq("class_id", classId ?? "")),
    ]);

    setSchoolId((profRes.data as any)?.school_id ?? null);

    const list = (collabRes.data as any[]) ?? [];
    if (list.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", list.map((r) => r.invited_teacher_id));
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setRows(
        list.map((r) => {
          const p = byId.get(r.invited_teacher_id);
          return {
            id: r.id,
            invited_teacher_id: r.invited_teacher_id,
            invited_by: r.invited_by,
            name: p ? fullName(p) : "Neznámý učitel",
            email: p?.email ?? null,
          };
        }),
      );
    } else {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, subjectId, classId, groupId]);

  const search = async () => {
    if (!schoolId || !user) return;
    const term = query.trim();
    let q = supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("school_id", schoolId)
      .neq("id", user.id)
      .limit(20);
    if (term) {
      q = q.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
    const { data, error } = await q;
    if (error) {
      toast({ title: "Hledání se nepovedlo", description: error.message, variant: "destructive" });
      return;
    }
    const ids = (data ?? []).map((p: any) => p.id);
    if (!ids.length) {
      setCandidates([]);
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids)
      .in("role", ["teacher", "lektor"]);
    const teacherIds = new Set((roles ?? []).map((r: any) => r.user_id));
    const already = new Set(rows.map((r) => r.invited_teacher_id));
    setCandidates(((data as CandidateRow[]) ?? []).filter((p) => teacherIds.has(p.id) && !already.has(p.id)));
  };

  const invite = async (teacherId: string) => {
    if (!user || !subjectId) return;
    setBusy(true);
    const { error } = await supabase.from("teaching_unit_collaborators").insert({
      subject_id: subjectId,
      class_id: groupId ? null : classId ?? null,
      group_id: groupId ?? null,
      invited_teacher_id: teacherId,
      invited_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast({
        title: "Pozvání se nepovedlo",
        description: error.message.includes("stejné školy")
          ? "Spoluučitele lze pozvat pouze v rámci stejné školy."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Spoluučitel přidán", description: "Získal přístup k obsahu této Výuky." });
    setCandidates((prev) => prev.filter((c) => c.id !== teacherId));
    load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("teaching_unit_collaborators").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast({ title: "Nepodařilo se odebrat", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Spoluučitel odebrán" });
  };

  if (!subjectId) return null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Spoluučitelé této Výuky
          </h3>
          <p className="text-sm text-muted-foreground">
            Pozvaný učitel uvidí a může upravovat zadání, plány hodin a pracovní listy této Výuky
            i výsledky žáků. K jiným předmětům téže třídy přístup nezíská.
          </p>
        </div>
        <Badge variant="outline">{rows.length} pozvaných</Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím nikoho nespolupracuje na této Výuce.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{r.email ?? "—"}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => remove(r.id)}
                  aria-label={`Odebrat ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!schoolId ? (
        <p className="text-sm text-muted-foreground">
          Váš profil nemá přiřazenou školu, proto nelze spoluučitele pozvat. Požádejte prosím
          správce školy o přiřazení.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search();
              }}
              placeholder="Jméno nebo e-mail učitele ze stejné školy"
            />
            <Button variant="outline" onClick={search} disabled={busy}>
              <Search className="h-4 w-4 mr-2" /> Najít
            </Button>
          </div>
          {candidates.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {candidates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{fullName(c)}</span>{" "}
                    <span className="text-xs text-muted-foreground">{c.email ?? ""}</span>
                  </span>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => invite(c.id)}>
                    <UserPlus className="h-4 w-4 mr-2" /> Pozvat
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};

export default TeachingUnitCollaboratorsCard;
