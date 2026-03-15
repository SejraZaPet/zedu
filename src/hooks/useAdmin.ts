import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAdmin = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, role, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !user) {
      navigate("/auth");
      return;
    }

    const checkAdmin = async () => {
      // Check account status
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      if (profile && profile.status !== "approved") {
        await signOut();
        navigate("/auth");
        return;
      }

      if (role === "admin") {
        setIsAdmin(true);
        setIsTeacher(false);
      } else if (role === "teacher") {
        setIsAdmin(true);
        setIsTeacher(true);
      } else {
        await signOut();
        navigate("/auth");
        return;
      }

      setLoading(false);
    };

    checkAdmin();
  }, [authLoading, isLoggedIn, user, role, navigate, signOut]);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return { isAdmin, isTeacher, loading, logout };
};
