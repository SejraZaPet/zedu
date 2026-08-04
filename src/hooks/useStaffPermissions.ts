import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ModulePermission {
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Načte oprávnění přihlášeného uživatele pro jednotlivé admin moduly.
 * Admin má vždy plný přístup ke všem modulům.
 */
export const useStaffPermissions = () => {
  const { user, realRole, loading: authLoading } = useAuth();
  const isAdmin = realRole === "admin";
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user || isAdmin) {
      setPermissions({});
      setIsStaff(false);
      setLoading(false);
      return;
    }

    (async () => {
      const { data: staff } = await supabase
        .from("staff_members")
        .select("id, active")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (!staff || !staff.active) {
        setIsStaff(false);
        setPermissions({});
        setLoading(false);
        return;
      }

      const { data: perms } = await supabase
        .from("staff_permissions")
        .select("module, can_view, can_edit")
        .eq("staff_member_id", staff.id);

      if (!active) return;
      const map: Record<string, ModulePermission> = {};
      (perms ?? []).forEach((p) => {
        map[p.module] = { can_view: p.can_view, can_edit: p.can_edit };
      });
      setPermissions(map);
      setIsStaff(true);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, isAdmin]);

  const can = (module: string, needEdit = false) => {
    if (isAdmin) return true;
    const p = permissions[module];
    if (!p) return false;
    return needEdit ? p.can_edit : p.can_view;
  };

  const hasAnyPermission = isAdmin || Object.values(permissions).some((p) => p.can_view || p.can_edit);

  return { loading: loading || authLoading, isAdmin, isStaff, permissions, can, hasAnyPermission };
};
