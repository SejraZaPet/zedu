export interface ClassDemoVisibilityItem {
  archived: boolean;
  name: string;
  school: string;
  field_of_study: string;
  created_by?: string | null;
  is_demo_school?: boolean;
  taught_by_current_user?: boolean;
}

export interface ClassDisplayFilter {
  userId?: string;
  showArchived: boolean;
  showDemoClasses: boolean;
  search: string;
}

/** Skryje jen nepoužívané třídy demo škol; vlastní a vyučované třídy zůstanou. */
export const isUnusedDemoClass = (
  item: Pick<ClassDemoVisibilityItem, "created_by" | "is_demo_school" | "taught_by_current_user">,
  userId?: string,
) => item.is_demo_school === true
  && item.taught_by_current_user !== true
  && (!userId || item.created_by !== userId);

export const filterClassesForDisplay = <T extends ClassDemoVisibilityItem>(
  classes: T[],
  { userId, showArchived, showDemoClasses, search }: ClassDisplayFilter,
): T[] => classes.filter((item) => {
  if (item.archived !== showArchived) return false;
  if (!showDemoClasses && isUnusedDemoClass(item, userId)) return false;
  if (!search) return true;
  const query = search.toLowerCase();
  return `${item.name} ${item.school} ${item.field_of_study}`.toLowerCase().includes(query);
});

export const countHiddenDemoClasses = (
  classes: ClassDemoVisibilityItem[],
  userId: string | undefined,
  showArchived: boolean,
) => classes.filter((item) => item.archived === showArchived && isUnusedDemoClass(item, userId)).length;

export const hiddenDemoClassesLabel = (count: number) => {
  if (count === 1) return "1 demo třída skryta";
  if (count >= 2 && count <= 4) return `${count} demo třídy skryty`;
  return `${count} demo tříd skryto`;
};
