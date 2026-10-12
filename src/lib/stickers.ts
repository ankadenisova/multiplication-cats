/** Cat stickers for the album: one per counted session, in order; after the last one the set repeats. */
import { t } from "@/lib/i18n";

export type Accessory = "none" | "bow" | "crown" | "glasses" | "flower" | "hat" | "star" | "heart";

/** Fur colours; the names live in the dictionary (t.stickers.furs, same order). */
const FURS = ["#FFC58A", "#FFE7C2", "#D3CFE2", "#FFFFFF", "#FFC9DD", "#CFE3FF", "#C8F0DC", "#E2D4FF"] as const;

const ACCESSORIES: Accessory[] = ["bow", "crown", "glasses", "flower", "hat", "star", "heart", "none"];

export type Sticker = { index: number; fur: string; accessory: Accessory; name: string };

export const STICKER_COUNT = 24;

export function sticker(i: number): Sticker {
  const index = ((i % STICKER_COUNT) + STICKER_COUNT) % STICKER_COUNT;
  const furIndex = index % FURS.length;
  const accessory = ACCESSORIES[(index + Math.floor(index / FURS.length) * 3) % ACCESSORIES.length];
  return { index, fur: FURS[furIndex], accessory, name: t.stickers.name(t.stickers.furs[furIndex], t.stickers.accessories[accessory]) };
}
