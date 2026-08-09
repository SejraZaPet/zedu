import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

export const useAdmin = () => {
  const navigate = useNavigate();
  const { isLoggedIn, role, status, loading: authLoading, signOut } = useAuth();
  const { loading: staffLoading, hasAnyPermission, isStaff: isStaffMember } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (authLoading || staffLoading) return;

    if (!isLoggedIn) {
      navigate("/auth");
      return;
    }

    if (role === null || status === null) return;

    if (status !== "approved") {
      signOut().then(() => navigate("/auth"));
      return;
    }

    if (role === "admin") {
      setIsAdmin(true);
      setIsStaff(false);
      setIsTeacher(false);
      setLoading(false);
      return;
    }

    // Zaměstnanci (i bez přiznaných modulů) mají přístup do administrace — Můj panel
    if (hasAnyPermission || isStaffMember) {
      setIsAdmin(false);
      setIsStaff(true);
      setIsTeacher(false);
      setLoading(false);
      return;
    }


    if (role === "school_admin") {
      navigate("/skola");
      return;
    }

    if (role === "teacher" || role === "lektor") {
      // Teachers have their own panel at /ucitel, not /admin
      navigate("/ucitel");
      return;
    }

    if (role === "rodic") {
      navigate("/rodic");
      return;
    }

    // Everyone else (user) goes to student dashboard
    navigate("/student");
  }, [authLoading, staffLoading, hasAnyPermission, isLoggedIn, role, status, navigate, signOut]);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return { isAdmin, isStaff, isTeacher, role, loading, logout };

};
