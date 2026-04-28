import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

const LABELS: Record<string, string> = {
  admin: "Administrátor",
  teacher: "Učitel",
  user: "Žák",
};

/**
 * Floating banner shown only when an admin is using the "view as" override.
 * Lets the admin return to their admin view from anywhere in the app.
 */
const ViewAsBanner = () => {
  const { realRole, viewAsRole, setViewAsRole } = useAuth();
  if (realRole !== "admin" || !viewAsRole || viewAsRole === "admin") return null;

  const label = LABELS[viewAsRole] ?? viewAsRole;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 backdrop-blur px-3 py-1.5 shadow-lg">
      <Eye className="w-4 h-4 text-primary" />
      <span className="text-sm">
        Prohlížíš jako <strong>{label}</strong>
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => {
          setViewAsRole(null);
          window.location.href = "/admin";
        }}
      >
        <X className="w-3.5 h-3.5 mr-1" /> Zpět na admina
      </Button>
    </div>
  );
};

export default ViewAsBanner;
