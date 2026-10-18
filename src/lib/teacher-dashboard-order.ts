/** Add the newly introduced tools near the top without moving existing widgets. */
export function mergeTeacherDashboardOrder(saved: readonly string[], defaults: readonly string[]): string[] {
  const merged = [...new Set(saved.filter(id => defaults.includes(id)))];
  if (!merged.includes("classroom-tools") && defaults.includes("classroom-tools")) {
    const today = merged.indexOf("today");
    merged.splice(today >= 0 ? today + 1 : 0, 0, "classroom-tools");
  }
  return [...merged, ...defaults.filter(id => !merged.includes(id))];
}