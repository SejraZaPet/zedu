export interface PlacementVisibilityInput {
  class_id: string | null;
  subject_group_id: string | null;
  grade_number: number;
  scope_all_grades: boolean;
}

export interface StudentPlacementContext {
  classIds: ReadonlySet<string>;
  subjectGroupIds: ReadonlySet<string>;
  gradeNumbers: ReadonlySet<number>;
}

export const isPlacementVisibleToStudent = (
  placement: PlacementVisibilityInput,
  student: StudentPlacementContext,
): boolean => {
  const matchesTarget = placement.class_id
    ? student.classIds.has(placement.class_id)
    : placement.subject_group_id
      ? student.subjectGroupIds.has(placement.subject_group_id)
      : true;

  return matchesTarget
    && (placement.scope_all_grades || student.gradeNumbers.has(placement.grade_number));
};