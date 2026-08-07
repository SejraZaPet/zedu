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
      const { data, error } = await supabase.rpc("my_school_sale_settings");
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setState({ kind: "none" });
        return;
      }
      setState({
        kind: "school",
        name: row.school_name,
        allows: !!row.allows_teacher_creators,
        recipient: (row.creator_payout_recipient as "teacher" | "school") ?? "school",
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
