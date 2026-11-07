import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { isPresentationRoute } from "@/lib/presentation-routes";
import { isPreviewStudentSession } from "@/lib/preview-student";
import { useIdleChrome } from "@/hooks/useIdleChrome";

const LABELS: Record<string, string> = {
  admin: "Administrátor",
  school_admin: "Admin školy",
  teacher: "Učitel",
  user: "Žák",
};

function useIsFullscreen() {
  const [fs, setFs] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  return fs;
}

/**
 * Kompaktní pilulka při admin „view as“; na promítání jen miniaturní ikona.
 * Návrat: setViewAsRole(null) → /admin (stejně i v menu „Přepnout roli“).
 */
const ViewAsBanner = () => {
  const { realRole, viewAsRole, setViewAsRole } = useAuth();
  const { pathname } = useLocation();
  const fullscreen = useIsFullscreen();
  const visible = realRole === "admin" && !!viewAsRole && viewAsRole !== "admin";
  const compactMode = isPresentationRoute(pathname) || fullscreen;
  const chromeVisible = useIdleChrome(visible && compactMode);
  const pillShown = visible && !compactMode;
  const stackedSession = pillShown && isPreviewStudentSession();
  useEffect(() => {
    if (!pillShown) return;
    const b = document.body.classList;
    b.add("has-view-as-pill");
    if (stackedSession) b.add("has-view-as-pill--stacked");
    return () => b.remove("has-view-as-pill", "has-view-as-pill--stacked");
  }, [pillShown, stackedSession]);
  if (!visible) return null;

  const label = LABELS[viewAsRole] ?? viewAsRole;
  const fullLabel = `Prohlížíš jako ${label} · Zpět na admina`;
  const goBack = () => {
    setViewAsRole(null);
    window.location.href = "/admin";
  };

  if (compactMode) {
    return (
      <button
        type="button"
        data-testid="view-as-icon"
        aria-label={fullLabel}
        title={fullLabel}
        onClick={goBack}
        className={`fixed left-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-card/70 text-primary shadow transition-opacity duration-300 motion-reduce:transition-none hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chromeVisible ? "opacity-60" : "pointer-events-none opacity-0"}`}
      >
        <Eye className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  const stacked = isPreviewStudentSession();
  return (
    <div
      data-testid="view-as-pill"
      title={fullLabel}
      className={`view-as-pill ${stacked ? "view-as-pill--stacked" : ""} fixed z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 whitespace-nowrap rounded-full border border-primary/30 bg-card/95 py-0.5 pl-3 pr-1 text-xs shadow-lg backdrop-blur sm:text-sm`}
    >
      <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="hidden sm:inline">Prohlížíš jako <strong>{label}</strong></span>
      <Button size="sm" variant="ghost" className="h-11 px-2 text-xs sm:h-8 sm:text-sm" aria-label={fullLabel} onClick={goBack}>
        <X className="mr-1 h-3.5 w-3.5" aria-hidden />
        <span className="sm:hidden">Zpět</span>
        <span className="hidden sm:inline">Zpět na admina</span>
      </Button>
    </div>
  );
};

export default ViewAsBanner;
