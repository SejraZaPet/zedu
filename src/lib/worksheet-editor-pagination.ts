import type { WorksheetItem } from "@/lib/worksheet-spec";

export interface WorksheetEditorPage {
  items: WorksheetItem[];
  hasOversizedItem: boolean;
}

interface PaginationOptions {
  firstPageCapacity: number;
  pageCapacity: number;
  gap: number;
  fallbackItemHeight?: number;
}

export function paginateWorksheetEditorItems(
  items: WorksheetItem[],
  heights: Readonly<Record<string, number>>,
  options: PaginationOptions,
): WorksheetEditorPage[] {
  const fallback = options.fallbackItemHeight ?? 160;
  const pages: WorksheetEditorPage[] = [];
  let current: WorksheetItem[] = [];
  let used = 0;
  let capacity = options.firstPageCapacity;

  const flush = () => {
    if (current.length === 0) return;
    pages.push({
      items: current,
      hasOversizedItem: current.length === 1 && (heights[current[0].id] ?? fallback) > capacity,
    });
    current = [];
    used = 0;
    capacity = options.pageCapacity;
  };

  for (const item of items) {
    const height = Math.max(1, heights[item.id] ?? fallback);
    const nextHeight = used + (current.length > 0 ? options.gap : 0) + height;
    if (current.length > 0 && nextHeight > capacity) flush();
    current.push(item);
    used += (current.length > 1 ? options.gap : 0) + height;
    if (current.length === 1 && used > capacity) flush();
  }

  flush();
  return pages.length > 0 ? pages : [{ items: [], hasOversizedItem: false }];
}