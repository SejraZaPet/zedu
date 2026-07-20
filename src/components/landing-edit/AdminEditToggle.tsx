import { Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLandingEditMode } from "@/contexts/LandingEditModeContext";
import { Button } from "@/components/ui/button";

export default function AdminEditToggle() {
  const { realRole } = useAuth();
  const { isEditMode, enterEditMode } = useLandingEditMode();

  if (realRole !== "admin") return null;
  if (isEditMode) return null;

  return (
    <Button
      onClick={enterEditMode}
      size="sm"
      className="fixed top-20 right-4 z-40 shadow-lg"
      aria-label="Upravit stránku"
    >
      <Pencil className="w-4 h-4 mr-2" /> Upravit stránku
    </Button>
  );
}
