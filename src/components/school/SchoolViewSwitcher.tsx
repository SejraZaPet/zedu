import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { School, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

/**
 * Trvalý přepínač pohledu pro uživatele, který je zároveň školní admin i učitel.
 * Volba se ukládá k účtu (profiles.preferred_view), nejde o dočasný "view as".
 */
const SchoolViewSwitcher = ({ className }: { className?: string }) => {
  const { canSwitchSchoolView, preferredView, setPreferredView, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  if (!canSwitchSchoolView) return null;

  const inTeacherView = preferredView
    ? preferredView === "teacher"
    : role === "teacher" || role === "lektor";

  const switchTo = async (view: "school_admin" | "teacher") => {
    setSaving(true);
    try {
      await setPreferredView(view);
      toast({
        title: view === "teacher" ? "Přepnuto na Moje výuka" : "Přepnuto na Administraci školy",
        description: "Nastavení jsme uložili k vašemu účtu.",
      });
      navigate(view === "teacher" ? "/ucitel" : "/skola", { replace: true });
    } finally {
      setSaving(false);
    }
  };


  return (
    <Button
      variant="outline"
      size="sm"
      disabled={saving}
      className={`gap-2 ${className ?? ""}`}
      onClick={() => switchTo(inTeacherView ? "school_admin" : "teacher")}
    >
      {inTeacherView ? <School className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
      {inTeacherView ? "Administrace školy" : "Moje výuka"}
    </Button>
  );
};

export default SchoolViewSwitcher;
