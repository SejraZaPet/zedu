export type { WorksheetItemProps, ItemAnswer } from "./types";

export { default as MCQItem } from "./MCQItem";
export { default as TrueFalseItem } from "./TrueFalseItem";
export { default as FillBlankItem } from "./FillBlankItem";
export { default as MatchingItem } from "./MatchingItem";
export { default as OrderingItem } from "./OrderingItem";
export { default as ShortAnswerItem } from "./ShortAnswerItem";
export { default as OpenAnswerItem } from "./OpenAnswerItem";

import type { ItemType } from "@/lib/worksheet-spec";
import type { FC } from "react";
import type { WorksheetItemProps } from "./types";

import MCQItem from "./MCQItem";
import TrueFalseItem from "./TrueFalseItem";
import FillBlankItem from "./FillBlankItem";
import MatchingItem from "./MatchingItem";
import OrderingItem from "./OrderingItem";
import ShortAnswerItem from "./ShortAnswerItem";
import OpenAnswerItem from "./OpenAnswerItem";

/** Registry mapping item type → renderer component */
export const ITEM_RENDERERS: Record<ItemType, FC<WorksheetItemProps>> = {
  mcq: MCQItem,
  true_false: TrueFalseItem,
  fill_blank: FillBlankItem,
  matching: MatchingItem,
  ordering: OrderingItem,
  short_answer: ShortAnswerItem,
  open_answer: OpenAnswerItem,
};
