import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const MOODS = ["bezli", "minimal", "natural"] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_STORAGE_KEY = "Bezli:mood";
export const MOOD_OWNER_STORAGE_KEY = "Bezli:mood-owner";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function normalizeMood(value: unknown): Mood {
  return MOODS.includes(value as Mood) ? (value as Mood) : "bezli";
}

export function readStoredMood(storage?: StorageLike | null): { mood: Mood; ownerId: string | null } {
  try {
    return {
      mood: normalizeMood(storage?.getItem(MOOD_STORAGE_KEY)),
      ownerId: storage?.getItem(MOOD_OWNER_STORAGE_KEY) || null,
    };
  } catch {
    return { mood: "bezli", ownerId: null };
  }
}

/** A saved browser mood belongs only to the same signed-in user. */
export function moodForUser(stored: Mood, ownerId: string | null, userId: string | null): Mood {
  return userId && ownerId === userId ? stored : "bezli";
}

const listeners = new Set<(mood: Mood) => void>();

function notify(mood: Mood) {
  listeners.forEach((listener) => listener(mood));
}

function applyToDocument(mood: Mood) {
  if (typeof document !== "undefined") document.documentElement.dataset.mood = mood;
}

function storeMood(mood: Mood, ownerId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (ownerId) {
      window.localStorage.setItem(MOOD_STORAGE_KEY, mood);
      window.localStorage.setItem(MOOD_OWNER_STORAGE_KEY, ownerId);
    } else {
      window.localStorage.removeItem(MOOD_STORAGE_KEY);
      window.localStorage.removeItem(MOOD_OWNER_STORAGE_KEY);
    }
  } catch {
    // Nálada funguje i bez dostupného localStorage, ale jen do konce relace.
  }
}

function currentMood(): Mood {
  if (typeof document !== "undefined") return normalizeMood(document.documentElement.dataset.mood);
  return readStoredMood(typeof window === "undefined" ? null : window.localStorage).mood;
}

export function useMood() {
  const { user, loading: authLoading } = useAuth();
  const [mood, setMoodState] = useState<Mood>(currentMood);
  const userId = user?.id ?? null;

  useEffect(() => {
    const listener = (next: Mood) => setMoodState(next);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const stored = readStoredMood(window.localStorage);
    const next = moodForUser(stored.mood, stored.ownerId, userId);
    applyToDocument(next);
    storeMood(next, userId);
    setMoodState(next);
    notify(next);
  }, [authLoading, userId]);

  const setMood = useCallback((next: Mood) => {
    const normalized = normalizeMood(next);
    applyToDocument(normalized);
    storeMood(normalized, userId);
    setMoodState(normalized);
    notify(normalized);
  }, [userId]);

  return { mood, setMood };
}

/** Keeps the synchronous index.html preview aligned with the active account. */
export function MoodSync() {
  useMood();
  return null;
}
