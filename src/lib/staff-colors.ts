/** Předvolená paleta barev pro pracovní kalendář a úkoly (Google Calendar styl). */
export const STAFF_COLORS = [
  { value: "#2F6F75", label: "Petrolejová" },
  { value: "#6EC6D9", label: "Tyrkysová" },
  { value: "#9B6CFF", label: "Fialová" },
  { value: "#E8618C", label: "Růžová" },
  { value: "#F2994A", label: "Oranžová" },
  { value: "#F2C94C", label: "Žlutá" },
  { value: "#27AE60", label: "Zelená" },
  { value: "#6B7A8F", label: "Šedomodrá" },
] as const;

export const DEFAULT_STAFF_COLOR = STAFF_COLORS[0].value;

/** Reminder nabídka v minutách před událostí. */
export const REMINDER_OPTIONS = [
  { value: 5, label: "5 minut předem" },
  { value: 15, label: "15 minut předem" },
  { value: 30, label: "30 minut předem" },
  { value: 60, label: "1 hodinu předem" },
  { value: 1440, label: "1 den předem" },
  { value: 2880, label: "2 dny předem" },
] as const;

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Neopakuje se" },
  { value: "daily", label: "Denně" },
  { value: "weekly", label: "Týdně" },
  { value: "monthly", label: "Měsíčně" },
] as const;
