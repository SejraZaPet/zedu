import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SchoolColleague {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

/**
 * Zjistí, zda je přihlášený uživatel pod licencí školy (profiles.school_id).
 * Samostatní lektoři bez školy dostanou schoolId === null a funkce školy se jim vůbec nezobrazí.
 */
export function useMySchool() {
  const { user, loading: authLoading } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSchoolId(null);
      setSchoolName(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("school_id, schools:school_id(name)")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setSchoolId((data as any)?.school_id ?? null);
      setSchoolName((data as any)?.schools?.name ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { schoolId, schoolName, loading: loading || authLoading, hasSchool: !!schoolId };
}

/** Kolegové ze stejné školy (bez sebe sama). */
export function useSchoolColleagues(schoolId: string | null) {
  const { user } = useAuth();
  const [colleagues, setColleagues] = useState<SchoolColleague[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) {
      setColleagues([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Kontaktní údaje kolegů nejsou čitelné — používáme bezpečný adresář školy.
      const { data } = await supabase.rpc("school_directory");
      if (cancelled) return;
      const list = ((data ?? []) as any[])
        .map((p) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, email: null }))
        .sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "", "cs"));
      setColleagues((list as SchoolColleague[]).filter((p) => p.id !== user?.id));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId, user?.id]);

  return { colleagues, loading };
}

export const colleagueLabel = (p?: SchoolColleague | null) =>
  p
    ? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "Kolega"
    : "";
