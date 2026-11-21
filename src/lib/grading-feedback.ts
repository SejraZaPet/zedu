import { supabase } from "@/integrations/supabase/client";
import { assignmentDescriptionToText } from "@/lib/assignment-description";

export interface GradingAttachment {
  file_name: string;
  file_path: string;
  file_type?: string | null;
}

export interface AssignmentFeedbackRequestInput {
  assignment: {
    /** ID úkolu: server přes token učitele dočte propojenou lekci a materiály zadání. */
    id?: string;
    title: string;
    description?: string | null;
    settings?: unknown;
  };
  answers?: unknown;
  submissionNote?: string | null;
  attachments: GradingAttachment[];
  score?: number | null;
  maxScore?: number | null;
}

function hasAnswerContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasAnswerContent);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasAnswerContent);
  return true;
}

/** Text odpovědi doplněný o poznámku; prázdný objekt odpovědí se AI neposílá jako práce. */
export function buildAssignmentStudentAnswer(answers: unknown, submissionNote?: string | null): string {
  const answer = hasAnswerContent(answers)
    ? typeof answers === "string"
      ? answers.trim()
      : JSON.stringify(answers, null, 2)
    : "";
  const note = submissionNote?.trim() ? `Poznámka žáka:\n${submissionNote.trim()}` : "";
  return [answer, note].filter(Boolean).join("\n\n");
}

export function assignmentAttachmentRefs(files: GradingAttachment[]) {
  return files.map((file) => ({
    path: file.file_path,
    name: file.file_name,
    type: file.file_type || "",
  }));
}

export function assignmentCriteria(settings: unknown): string {
  if (!settings || typeof settings !== "object") return "";
  const value = settings as Record<string, unknown>;
  for (const key of ["criteria", "gradingCriteria", "rubric"]) {
    if (typeof value[key] === "string") return value[key];
  }
  if (Array.isArray(value.criteria)) {
    return value.criteria.map((criterion) => {
      if (typeof criterion === "string") return criterion;
      if (!criterion || typeof criterion !== "object") return "";
      const item = criterion as Record<string, unknown>;
      const label = String(item.criterion ?? item.title ?? "").trim();
      const points = Number(item.points);
      return label ? `${label}${Number.isFinite(points) && points > 0 ? ` (${points} b)` : ""}` : "";
    }).filter(Boolean).join("\n");
  }
  return "";
}

/** Jednotný vstup pro textový návrh z úkolu; přílohy se předávají jako cesty, ne podepsané URL. */
export function buildAssignmentFeedbackRequest(input: AssignmentFeedbackRequestInput) {
  const description = input.assignment.description
    ? assignmentDescriptionToText(input.assignment.description)
    : "";
  return {
    question: [input.assignment.title.trim(), description].filter(Boolean).join("\n\n"),
    criteria: assignmentCriteria(input.assignment.settings),
    studentAnswer: buildAssignmentStudentAnswer(input.answers, input.submissionNote),
    attachments: assignmentAttachmentRefs(input.attachments),
    score: input.score ?? null,
    maxScore: input.maxScore ?? null,
    ...(input.assignment.id ? { assignmentId: input.assignment.id } : {}),
  };
}

async function functionError(error: any): Promise<Error> {
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === "string" && payload.error.trim()) return new Error(payload.error);
    } catch {
      // Níže použijeme bezpečnou původní hlášku SDK.
    }
  }
  return new Error(error?.message || "Návrh se nepodařilo vytvořit, zkuste to prosím znovu.");
}

async function invokeSuggestion(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("suggest-grading-feedback", { body });
  if (error) throw await functionError(error);
  return data;
}

export async function requestAssignmentFeedback(input: AssignmentFeedbackRequestInput): Promise<string> {
  const data = await invokeSuggestion(buildAssignmentFeedbackRequest(input));
  const feedback = typeof data?.feedback === "string" ? data.feedback.trim() : "";
  if (!feedback) throw new Error("AI nevrátila žádný návrh. Zkuste to prosím znovu.");
  return feedback;
}

export interface WorksheetPointRequestItem {
  id: string;
  prompt: string;
  answer: string;
  max: number;
  rubric?: string;
}

export interface WorksheetPointSuggestion {
  id: string;
  points: number;
  reason: string;
}

export async function requestWorksheetPoints(question: string, items: WorksheetPointRequestItem[]): Promise<WorksheetPointSuggestion[]> {
  const data = await invokeSuggestion({ mode: "worksheet_points", question, items });
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    throw new Error("AI nevrátila použitelný návrh bodů. Zkuste to prosím znovu.");
  }
  return data.items;
}
