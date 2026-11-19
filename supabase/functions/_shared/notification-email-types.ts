// Jediný přepínač: které typy in-app notifikací NEdostávají e-mailovou kopii.
// Notifikace v aplikaci (a počítadla) vznikají dál; tady se vypíná jen e-mail.
// Vrácení: odeber typ ze seznamu.
export const EMAIL_DISABLED_NOTIFICATION_TYPES: readonly string[] = [
  "assignment_submitted", // „Žák odevzdal úkol“ – učitel vidí v Ke kontrole
];

export function notificationTypeSendsEmail(type: unknown): boolean {
  return !EMAIL_DISABLED_NOTIFICATION_TYPES.includes(String(type ?? ""));
}
