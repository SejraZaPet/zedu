import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeGradient, type SlideGradient } from "@/lib/slide-gradient";

/** Uložená hodnota v paletě: plná barva (hex) nebo přechod. */
export type PaletteValue = string | SlideGradient;

export interface UserPalette {
  id: string;
  name: string;
  colors: PaletteValue[];
  created_at: string;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Ověří a pročistí hodnoty načtené z DB (jsonb může obsahovat cokoliv). */
export function normalizePaletteValues(raw: unknown): PaletteValue[] {
  if (!Array.isArray(raw)) return [];
  const out: PaletteValue[] = [];
  for (const v of raw) {
    if (typeof v === "string" && HEX_RE.test(v.trim())) out.push(v.trim());
    else {
      const g = normalizeGradient(v);
      if (g) out.push(g);
    }
  }
  return out;
}

export const isGradientPaletteValue = (v: PaletteValue): v is SlideGradient =>
  typeof v === "object" && v !== null;

/** Vlastní uložené palety přihlášeného uživatele – společné pro celou appku. */
export function useColorPalettes() {
  const [palettes, setPalettes] = useState<UserPalette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_color_palettes")
      .select("id, name, colors, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setPalettes(
        data.map((r) => ({
          id: r.id,
          name: r.name,
          colors: normalizePaletteValues(r.colors),
          created_at: r.created_at,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePalette = useCallback(
    async (name: string, colors: PaletteValue[]) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { error: "Pro ukládání palet je potřeba přihlášení." };
      const { error } = await supabase
        .from("user_color_palettes")
        .insert({ user_id: uid, name: name.trim() || "Moje paleta", colors: colors as any });
      if (error) return { error: error.message };
      await load();
      return {};
    },
    [load],
  );

  const renamePalette = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase
        .from("user_color_palettes")
        .update({ name: name.trim() || "Moje paleta" })
        .eq("id", id);
      if (error) return { error: error.message };
      await load();
      return {};
    },
    [load],
  );

  const deletePalette = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("user_color_palettes").delete().eq("id", id);
      if (error) return { error: error.message };
      await load();
      return {};
    },
    [load],
  );

  return { palettes, loading, reload: load, savePalette, renamePalette, deletePalette };
}
