import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LandingSectionType =
  | "hero"
  | "social_proof"
  | "features_grid"
  | "how_it_works"
  | "for_whom"
  | "platform_showcase"
  | "podcast"
  | "final_cta";

export interface LandingSectionRow {
  id: string;
  order_index: number;
  section_type: LandingSectionType;
  enabled: boolean;
  props: Record<string, any>;
}

export function useLandingSections() {
  return useQuery({
    queryKey: ["landing_sections"],
    queryFn: async (): Promise<LandingSectionRow[]> => {
      const { data, error } = await supabase
        .from("landing_sections")
        .select("id, order_index, section_type, enabled, props")
        .eq("enabled", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LandingSectionRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function useAllLandingSections() {
  return useQuery({
    queryKey: ["landing_sections", "all"],
    queryFn: async (): Promise<LandingSectionRow[]> => {
      const { data, error } = await supabase
        .from("landing_sections")
        .select("id, order_index, section_type, enabled, props")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LandingSectionRow[];
    },
    staleTime: 30 * 1000,
  });
}
