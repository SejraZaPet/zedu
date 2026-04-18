import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const useAdmin = () => {
  const navigate = useNavigate();
  const { isLoggedIn, role, status, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn) {
      navigate("/auth");
      return;
    }

    if (role === null || status === null) return;

    if (status !== "approved") {
      signOut().then(() => navigate("/auth"));
      return;
    }

    const hasAccess = role === "admin" || role === "teacher" || role === "lektor";
    if (!hasAccess) {
      navigate("/student");
      return;
    }

    setLoading(false);
  }, [authLoading, isLoggedIn, role, status, navigate, signOut]);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  const isAdmin = role === "admin";
  const isTeacher = role === "teacher" || role === "lektor";

  return { isAdmin, isTeacher, role, loading, logout };
};
