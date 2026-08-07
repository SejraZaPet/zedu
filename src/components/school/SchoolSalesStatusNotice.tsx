import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock } from "lucide-react";

/**
 * Zobrazuje učiteli aktuální nastavení jeho školy ohledně prodeje materiálů,
 * aby předem věděl, co platí, než se pokusí něco nabídnout k prodeji.
 */
const SchoolSalesStatusNotice = () => {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "none" }
    | { kind: "school"; name: string; allows: boolean; recipient: "teacher" | "school" }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (!cancelled) setState({ kind: "none" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (!profile?.school_id) {
        setState({ kind: "none" });
        return;
      }
      const { data: school } = await supabase
        .from("schools")
        .select("name, allows_teacher_creators, creator_payout_recipient")
        .eq("id", profile.school_id)
        .maybeSingle();
      if (cancelled) return;
      if (!school) {
        setState({ kind: "none" });
        return;
      }
      setState({
        kind: "school",
        name: school.name,
        allows: !!school.allows_teacher_creators,
        recipient: (school.creator_payout_recipient as "teacher" | "school") ?? "school",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") return null;

  if (state.kind === "none") {
    return (
      <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        <Unlock className="w-4 h-4 mt-0.5 shrink-0" />
        <p>Nejste vázán(a) na školu — prodej vlastních materiálů máte odemčený a výnos jde vám.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
      {state.allows ? (
        <Unlock className="w-4 h-4 mt-0.5 shrink-0" />
      ) : (
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
      )}
      <p>
        {state.allows ? (
          <>
            Škola <span className="font-medium text-foreground">{state.name}</span> prodej materiálů
            učitelů <span className="font-medium text-foreground">povoluje</span>. Peníze z prodeje jdou{" "}
            <span className="font-medium text-foreground">
              {state.recipient === "teacher" ? "přímo vám" : "škole"}
            </span>
            .
          </>
        ) : (
          <>
            Škola <span className="font-medium text-foreground">{state.name}</span> zatím{" "}
            <span className="font-medium text-foreground">neumožňuje</span> prodej materiálů učitelů.
            Sdílení zdarma tím není omezené.
          </>
        )}
      </p>
    </div>
  );
};

export default SchoolSalesStatusNotice;
