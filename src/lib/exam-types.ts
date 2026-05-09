import { Mic, PenLine, Monitor, Lightbulb, ClipboardList, type LucideIcon } from "lucide-react";

export type ExamType = "ustni" | "pisemne" | "digitalni" | "projekt";

export interface ExamTypeMeta {
  value: ExamType | "ukol";
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for Badge */
  badgeClass: string;
  /** Hex color for calendar dot/border */
  color: string;
}

export const EXAM_TYPE_META: Record<ExamType | "ukol", ExamTypeMeta> = {
  ukol: {
    value: "ukol",
    label: "Úkol",
    icon: ClipboardList,
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    color: "#3B82F6",
  },
  ustni: {
    value: "ustni",
    label: "Ústní zkoušení",
    icon: Mic,
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    color: "#EF4444",
  },
  pisemne: {
    value: "pisemne",
    label: "Písemné",
    icon: PenLine,
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    color: "#10B981",
  },
  digitalni: {
    value: "digitalni",
    label: "Digitální test",
    icon: Monitor,
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    color: "#8B5CF6",
  },
  projekt: {
    value: "projekt",
    label: "Projekt",
    icon: Lightbulb,
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    color: "#F97316",
  },
};

export function getExamTypeMeta(examType: string | null | undefined): ExamTypeMeta {
  if (examType && examType in EXAM_TYPE_META) return EXAM_TYPE_META[examType as ExamType];
  return EXAM_TYPE_META.ukol;
}

export const EXAM_TYPE_OPTIONS: ExamTypeMeta[] = [
  EXAM_TYPE_META.ukol,
  EXAM_TYPE_META.ustni,
  EXAM_TYPE_META.pisemne,
  EXAM_TYPE_META.digitalni,
  EXAM_TYPE_META.projekt,
];
