/**
 * Typed microcopy accessor for UI_COPY.
 *
 * Usage:
 *   t("student.buttons.submit")        → "Odeslat"
 *   t("projector.playerCount", 3)       → "3 hráči"
 *   t("student.states.scoreResult", 5, 10) → "5 z 10 bodů"
 */

import { UI_COPY } from "./ui-microcopy";

type Leaf<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : T extends (...args: any[]) => string
    ? Prefix
    : {
        [K in keyof T & string]: Leaf<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>;
      }[keyof T & string];

export type UiCopyKey = Leaf<typeof UI_COPY>;

/**
 * Resolve a dot-path on UI_COPY.
 * If the leaf is a function, remaining args are forwarded.
 */
export function t(key: UiCopyKey, ...args: any[]): string {
  const parts = (key as string).split(".");
  let node: any = UI_COPY;
  for (const p of parts) {
    node = node?.[p];
    if (node === undefined) {
      console.warn(`[t] missing key: ${key}`);
      return key as string;
    }
  }
  if (typeof node === "function") return node(...args);
  if (typeof node === "string") return node;
  console.warn(`[t] key "${key}" resolved to non-string`);
  return key as string;
}
