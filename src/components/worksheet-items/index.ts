export type { WorksheetItemProps, ItemAnswer } from "./types";

export { default as MCQItem } from "./MCQItem";
export { default as TrueFalseItem } from "./TrueFalseItem";
export { default as FillBlankItem } from "./FillBlankItem";
export { default as MatchingItem } from "./MatchingItem";
export { default as OrderingItem } from "./OrderingItem";
export { default as ShortAnswerItem } from "./ShortAnswerItem";
export { default as OpenAnswerItem } from "./OpenAnswerItem";
export { default as OfflineActivityItem } from "./OfflineActivityItem";
export { default as LayoutBlockItem } from "./LayoutBlockItem";

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
import OfflineActivityItem from "./OfflineActivityItem";
import LayoutBlockItem from "./LayoutBlockItem";

/** Registry mapping item type → renderer component */
export const ITEM_RENDERERS: Record<ItemType, FC<WorksheetItemProps>> = {
  mcq: MCQItem,
  true_false: TrueFalseItem,
  fill_blank: FillBlankItem,
  matching: MatchingItem,
  ordering: OrderingItem,
  short_answer: ShortAnswerItem,
  open_answer: OpenAnswerItem,
  offline_activity: OfflineActivityItem,
  section_header: LayoutBlockItem,
  write_lines: LayoutBlockItem,
  instruction_box: LayoutBlockItem,
  two_boxes: LayoutBlockItem,
  qr_link: LayoutBlockItem,
  flow_steps: LayoutBlockItem,
};
