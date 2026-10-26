import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Banner } from "@/lib/banners";

export function useMyBanners() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-banners", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await (supabase.rpc as any)("get_my_banners");
      if (error) return [];
      return (data ?? []) as Banner[];
    },
  });
}
