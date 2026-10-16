// Lehká synchronizace stavu živé hry pro hráče.
// Hráč bez účtu (user_id = null) nemůže přes RLS číst tabulku game_sessions,
// takže mu realtime události o změně otázky nedorazí. Stav proto doplňujeme
// průběžným dotazem na bezpečnou funkci get_player_session (ověřuje joinToken
// a vrací jen data bez správných odpovědí) a sloučíme z ní jen neškodná pole.

export interface LightSessionState {
  status: string;
  current_question_index: number;
  question_started_at: string | null;
}

export function extractLightState(row: any): LightSessionState | null {
  if (!row || typeof row !== "object") return null;
  if (typeof row.status !== "string") return null;
  return {
    status: row.status,
    current_question_index: typeof row.current_question_index === "number" ? row.current_question_index : 0,
    question_started_at: row.question_started_at ?? null,
  };
}

/** True, když se změnilo něco z lehkého stavu (otázka, fáze hry, čas startu). */
export function lightStateChanged(prev: any, light: LightSessionState): boolean {
  if (!prev) return true;
  return (
    prev.status !== light.status ||
    prev.current_question_index !== light.current_question_index ||
    (prev.question_started_at ?? null) !== light.question_started_at
  );
}

/**
 * Sloučí lehký stav do uložené session. Nikdy nepřepisuje activity_data,
 * settings ani teams — ta se načítají jen bezpečnou cestou (fetchData),
 * aby se hráči nikdy nedostaly správné odpovědi.
 */
export function applyLightSessionState<T extends Record<string, any>>(prev: T | null, light: LightSessionState): T | null {
  if (!prev) return prev;
  if (!lightStateChanged(prev, light)) return prev;
  return {
    ...prev,
    status: light.status,
    current_question_index: light.current_question_index,
    question_started_at: light.question_started_at,
  };
}

/** Počet snímků v řádku z get_player_session (activity_data_safe). */
export function rowSlidesLength(row: any): number {
  const d = row?.activity_data_safe ?? row?.activity_data;
  return Array.isArray(d) ? d.length : -1;
}
