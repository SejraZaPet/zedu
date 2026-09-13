import { useCallback, useEffect, useRef, useState } from "react";

const HISTORY_LIMIT = 100;
/** Rychlé změny (psaní textu, tažení bloku) se slévají do jednoho kroku historie. */
const COALESCE_MS = 400;

export interface ValueHistory {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo nad hodnotou, kterou drží někdo jiný (např. prezentace v rodiči).
 * Každá nová referenčně odlišná hodnota se uloží jako krok historie.
 */
export function useValueHistory<T>(value: T, setValue: (next: T) => void): ValueHistory {
  const historyRef = useRef<T[]>([value]);
  const indexRef = useRef(0);
  const applyingRef = useRef(false);
  const lastPushRef = useRef(0);
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  const [state, setState] = useState({ canUndo: false, canRedo: false });

  const sync = useCallback(() => {
    setState((prev) => {
      const next = {
        canUndo: indexRef.current > 0,
        canRedo: indexRef.current < historyRef.current.length - 1,
      };
      return prev.canUndo === next.canUndo && prev.canRedo === next.canRedo ? prev : next;
    });
  }, []);

  useEffect(() => {
    if (historyRef.current[indexRef.current] === value) {
      applyingRef.current = false;
      return;
    }
    if (applyingRef.current) {
      applyingRef.current = false;
      return;
    }

    const now = Date.now();
    const trimmed = historyRef.current.slice(0, indexRef.current + 1);
    if (indexRef.current > 0 && now - lastPushRef.current < COALESCE_MS) {
      trimmed[trimmed.length - 1] = value;
    } else {
      trimmed.push(value);
      if (trimmed.length > HISTORY_LIMIT) trimmed.shift();
    }
    lastPushRef.current = now;
    historyRef.current = trimmed;
    indexRef.current = trimmed.length - 1;
    sync();
  }, [value, sync]);

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    applyingRef.current = true;
    lastPushRef.current = 0;
    setValueRef.current(historyRef.current[indexRef.current]);
    sync();
  }, [sync]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    applyingRef.current = true;
    lastPushRef.current = 0;
    setValueRef.current(historyRef.current[indexRef.current]);
    sync();
  }, [sync]);

  return { undo, redo, canUndo: state.canUndo, canRedo: state.canRedo };
}
