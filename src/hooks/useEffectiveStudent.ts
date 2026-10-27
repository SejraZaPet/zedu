import { useAuth } from "@/contexts/AuthContext";
import { resolveEffectiveStudent } from "@/lib/effective-student";

export function useEffectiveStudent() {
  const { user, realRole, viewAsRole } = useAuth() as any;
  return resolveEffectiveStudent(user?.id, realRole, viewAsRole);
}
