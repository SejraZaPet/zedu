import { useEffect, useState } from "react";

/** Zapamatuje filtry v localStorage; neplatné hodnoty nahradí výchozími. */
export function useStoredFilters<T extends Record<string, string>>(
  key: string, defaults: T, isValid: (k: keyof T, v: string) => boolean = () => true,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (!raw || typeof raw !== "object") return defaults;
      const next = { ...defaults };
      (Object.keys(defaults) as (keyof T)[]).forEach((k) => {
        const v = raw[k];
        if (typeof v === "string" && isValid(k, v)) next[k] = v as T[keyof T];
      });
      return next;
    } catch { return defaults; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }, [key, value]);
  return [value, setValue, () => setValue(defaults)] as const;
}
