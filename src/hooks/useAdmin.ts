import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const useAdmin = () => {
  const navigate = useNavigate();
  const { isLoggedIn, role, status, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

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

    if (role === "admin") {
      setIsAdmin(true);
      setIsTeacher(false);
      setLoading(false);
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
  }, [authLoading, isLoggedIn, role, status, navigate, signOut]);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return { isAdmin, isTeacher, role, loading, logout };
};
