/**
 * Default color for newly created textbook subjects.
 *
 * This is a per-subject color stored as a literal hex in the database
 * (`textbook_subjects.color`) — users can override it in the UI, so it counts
 * as semantic user data, not a live brand token. Keeping it as a named
 * constant makes it obvious where to update the seed value when the brand
 * palette changes and eliminates the last hardcoded brand-adjacent hex
 * literals in the code path that creates subjects.
 *
 * Loosely tracks `--primary-light` (#63C7CF) in `src/index.css`.
 */
export const DEFAULT_SUBJECT_COLOR = "#6EC6D9";
