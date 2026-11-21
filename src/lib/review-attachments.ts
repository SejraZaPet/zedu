export interface ReviewAttachment {
  id: string;
  assignment_id: string;
  student_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at?: string | null;
}

/** Přílohy patřící k odevzdání: vlastní soubory žáka, u skupinové práce soubory všech členů. */
export function attachmentsForSubmission(
  all: ReviewAttachment[],
  studentId: string,
  groupMemberIds: string[] = [],
): ReviewAttachment[] {
  const owners = new Set([studentId, ...groupMemberIds]);
  return all.filter((a) => owners.has(a.student_id));
}

export function formatAttachmentSize(b: number | null | undefined): string {
  if (!b || b < 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} kB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
