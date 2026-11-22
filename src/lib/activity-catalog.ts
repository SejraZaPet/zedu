import { ACTIVITY_PRESETS, type ActivityPreset, type ActivityPresetId } from "@/lib/activity-slide-presets";

export interface ActivityCatalogGroup {
  id: "questions" | "practice" | "images" | "class" | "experience";
  label: string;
  presets: ActivityPreset[];
}

const GROUPS: { id: ActivityCatalogGroup["id"]; label: string; ids: ActivityPresetId[] }[] = [
  { id: "questions", label: "Otázky", ids: ["mcq", "quiz", "true_false", "poll", "open", "short_answer"] },
  { id: "practice", label: "Procvičování", ids: ["matching", "ordering", "fill_blanks", "fill_choice", "sorting", "flashcards", "reveal_cards", "memory_game", "crossword", "word_search"] },
  { id: "images", label: "Obrázky", ids: ["image_label", "image_hotspot"] },
  { id: "class", label: "Zapojení třídy", ids: ["wall", "wordcloud", "exit"] },
  { id: "experience", label: "Skupiny a zážitek", ids: ["teams", "differentiated", "escape", "bezlistart"] },
];

export const ACTIVITY_CATALOG_GROUPS: ActivityCatalogGroup[] = GROUPS.map((group) => ({
  ...group,
  presets: group.ids.map((id) => ACTIVITY_PRESETS.find((preset) => preset.id === id)).filter((preset): preset is ActivityPreset => !!preset),
}));

export const ACTIVITY_CATALOG_PRESETS = ACTIVITY_CATALOG_GROUPS.flatMap((group) => group.presets);
