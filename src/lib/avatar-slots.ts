/**
 * Layer slots for stackable avatar clothing/accessory items.
 *
 * Each slot on `avatar_profiles` holds at most one active item id at a time.
 * Selecting a new item in a slot replaces the previous one in the SAME slot
 * (other slots remain untouched).
 *
 * Conflict group — full outfit vs top/bottom:
 *   - Picking `clothing_full` clears `clothing_top` and `clothing_bottom`.
 *   - Picking `clothing_top` or `clothing_bottom` clears `clothing_full`.
 *
 * Ownership is preserved (we only clear the profile slot, not `user_avatar_items`).
 */
export type LayerSlot =
  | "hair"
  | "hair_accessory"
  | "clothing_top"
  | "clothing_bottom"
  | "clothing_full"
  | "clothing_shoes"
  | "clothing_head"
  | "clothing_face"
  | "clothing_neck"
  | "clothing_hands"
  | "clothing_bag";

/** Profile column name that stores the active item id for each slot. */
export const SLOT_PROFILE_COLUMN: Record<LayerSlot, string> = {
  hair: "hairstyle_id",
  hair_accessory: "hair_accessory_id",
  clothing_top: "clothing_top_id",
  clothing_bottom: "clothing_bottom_id",
  clothing_full: "clothing_full_id",
  clothing_shoes: "clothing_shoes_id",
  clothing_head: "clothing_head_id",
  clothing_face: "clothing_face_id",
  clothing_neck: "clothing_neck_id",
  clothing_hands: "clothing_hands_id",
  clothing_bag: "clothing_bag_id",
};

/** Human labels (Czech) shown as subtabs in the editor. */
export const SLOT_LABEL: Record<LayerSlot, string> = {
  hair: "Vlasy",
  hair_accessory: "Doplňky do vlasů",
  clothing_top: "Trika a mikiny",
  clothing_bottom: "Kalhoty a sukně",
  clothing_full: "Celé outfity",
  clothing_shoes: "Boty",
  clothing_head: "Čepice",
  clothing_face: "Brýle",
  clothing_neck: "Šály a kravaty",
  clothing_hands: "Rukavice a hodinky",
  clothing_bag: "Tašky a batohy",
};

/** Slots that appear under the single "Oblečení" category tab, in UI order. */
export const CLOTHING_SLOTS: LayerSlot[] = [
  "clothing_top",
  "clothing_bottom",
  "clothing_full",
  "clothing_shoes",
  "clothing_head",
  "clothing_face",
  "clothing_neck",
  "clothing_hands",
  "clothing_bag",
  "hair_accessory",
];

/**
 * When user activates the key slot, the listed slots are cleared on the
 * profile (item stays in the inventory).
 */
export const SLOT_CONFLICTS: Partial<Record<LayerSlot, LayerSlot[]>> = {
  clothing_full: ["clothing_top", "clothing_bottom"],
  clothing_top: ["clothing_full"],
  clothing_bottom: ["clothing_full"],
};

/**
 * Bottom→top render order for slot-based layers within the character stack.
 * `hair` (back/front) and the legacy `outfit_id` are handled by the caller.
 */
export const SLOT_LAYER_ORDER: LayerSlot[] = [
  "clothing_bottom",
  "clothing_shoes",
  "clothing_top",
  "clothing_full",
  "clothing_neck",
  "clothing_bag",
  "clothing_hands",
  // (hair front rendered by caller between here and head accessories)
  "hair_accessory",
  "clothing_head",
  "clothing_face",
];
