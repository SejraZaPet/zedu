import { useState } from "react";
import { Check, Repeat, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isPreviewStudentSession, returnFromPreviewStudent, switchToPreviewStudent } from "@/lib/preview-student";
import { roleSwitchOptions, type RoleSwitchOption } from "@/lib/role-switch";

const TARGETS: Record<string, string> = { admin: "/admin", school_admin: "/skola", teacher: "/ucitel", user: "/student" };

/** Oddíl „Přepnout roli“ v hlavním menu (desktop i mobil). Používá jen stávající přepínače. */
const RoleSwitchMenu = ({ onDone, variant }: { onDone?: () => void; variant: "dropdown" | "mobile" }) => {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const options = roleSwitchOptions({
    realRole: auth.realRole, roles: auth.roles, viewAsRole: auth.viewAsRole,
    canSwitchSchoolView: auth.canSwitchSchoolView, preferredView: auth.preferredView,
    role: auth.role, isPreviewSession: isPreviewStudentSession(),
  });
  if (!options.length) return null;

  const run = async (o: RoleSwitchOption) => {
    if (o.current || busy) return;
    setBusy(true);
    onDone?.();
    try {
      if (o.mode === "return") {
        const ok = await returnFromPreviewStudent();
        window.location.href = ok ? "/admin" : "/auth";
      } else if (o.mode === "preview") {
        await switchToPreviewStudent();
        window.location.href = "/student";
      } else if (o.mode === "viewAs") {
        auth.setViewAsRole(o.key === "admin" ? null : (o.key as "school_admin" | "teacher"));
        window.location.href = TARGETS[o.key];
      } else {
        await auth.setPreferredView(o.key as "school_admin" | "teacher");
        window.location.href = TARGETS[o.key];
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Přepnutí se nepodařilo.");
      setBusy(false);
    }
  };

  const itemCls = variant === "mobile"
    ? "flex items-center gap-3 px-3 min-h-11 rounded-lg text-base font-medium text-left w-full"
    : "flex items-center gap-2 px-2 min-h-11 rounded-sm text-sm text-left w-full hover:bg-accent focus:bg-accent outline-none";

  return (
    <div role="group" aria-label="Přepnout roli" className={variant === "mobile" ? "border-t border-border mt-2 pt-2" : "border-t border-border mt-1 pt-1"}>
      <p className="px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">Přepnout roli</p>
      {options.map((o) => (
        <button key={o.key} type="button" disabled={busy} aria-current={o.current ? "true" : undefined}
          onClick={() => run(o)}
          className={`${itemCls} ${o.current ? "text-primary bg-primary/10" : o.mode === "return" ? "text-primary font-semibold" : "text-muted-foreground hover:text-primary"}`}>
          {o.mode === "return" ? <Undo2 size={16} aria-hidden /> : o.current ? <Check size={16} aria-hidden /> : <Repeat size={16} aria-hidden />}
          <span>{o.label}</span>
          {o.current && <span className="ml-auto text-xs">(aktuální)</span>}
        </button>
      ))}
    </div>
  );
};

export default RoleSwitchMenu;
