export type ResultNameMode = "nickname" | "named" | "pseudonymous" | "anonymous";
export const DEFAULT_SCREEN_NAME_MODE: ResultNameMode = "nickname";
export const DEFAULT_EXPORT_NAME_MODE: ResultNameMode = "pseudonymous";

export function sessionDisplayName(
  player: { nickname?: string | null; user_id?: string | null } | undefined,
  index: number,
  mode: string,
  profiles: Record<string, string> = {},
): string {
  if (mode === "nickname") return player?.nickname || "Žák";
  if (mode === "named") return (player?.user_id && profiles[player.user_id]) || player?.nickname || "Žák";
  if (mode === "pseudonymous") return `Student_${index + 1}`;
  return `Účastník ${index + 1}`;
}