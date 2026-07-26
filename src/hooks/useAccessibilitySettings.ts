import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AccessibilitySettings {
  dyslexiaFont: boolean;
  largerLineHeight: boolean;
}

const DEFAULTS: AccessibilitySettings = {
  dyslexiaFont: false,
  largerLineHeight: false,
};

const applyBodyClasses = (s: AccessibilitySettings) => {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("a11y-dyslexia-font", !!s.dyslexiaFont);
  document.body.classList.toggle("a11y-line-height", !!s.largerLineHeight);
};

/**
 * Loads accessibility settings from the current user's profile and applies
 * them as body classes. Also exposes a saver that persists back to Supabase.
 */
export function useAccessibilitySettings() {
  const { user, isLoggedIn } = useAuth();
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      applyBodyClasses(DEFAULTS);
      setSettings(DEFAULTS);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("accessibility_settings")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const raw = ((data as any)?.accessibility_settings ?? {}) as Partial<AccessibilitySettings>;
      const next: AccessibilitySettings = {
        dyslexiaFont: !!raw.dyslexiaFont,
        largerLineHeight: !!raw.largerLineHeight,
      };
      setSettings(next);
      applyBodyClasses(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isLoggedIn]);

  const save = useCallback(
    async (next: AccessibilitySettings) => {
      setSettings(next);
      applyBodyClasses(next);
      if (!user) return { error: null as any };
      const { error } = await supabase
        .from("profiles")
        .update({ accessibility_settings: next as any })
        .eq("id", user.id);
      return { error };
    },
    [user]
  );

  return { settings, setSettings, save, loading };
}

/** Mount-once component that keeps body classes in sync with the signed-in user. */
export function AccessibilitySettingsSync() {
  useAccessibilitySettings();
  return null;
}
