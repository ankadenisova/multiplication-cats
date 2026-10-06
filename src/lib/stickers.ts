/** Cat stickers for the album: one per counted session, in order; after the last one the set repeats. */

export type Accessory = "none" | "bow" | "crown" | "glasses" | "flower" | "hat" | "star" | "heart";

const FURS = [
  { fur: "#FFC58A", name: "Рыжик" },
  { fur: "#FFE7C2", name: "Сливка" },
  { fur: "#D3CFE2", name: "Дымок" },
  { fur: "#FFFFFF", name: "Снежок" },
  { fur: "#FFC9DD", name: "Зефирка" },
  { fur: "#CFE3FF", name: "Голубика" },
  { fur: "#C8F0DC", name: "Мятка" },
  { fur: "#E2D4FF", name: "Лаванда" },
] as const;

const ACCESSORIES: { kind: Accessory; label: string }[] = [
  { kind: "bow", label: "с бантиком" },
  { kind: "crown", label: "в короне" },
  { kind: "glasses", label: "в очках" },
  { kind: "flower", label: "с цветочком" },
  { kind: "hat", label: "в колпачке" },
  { kind: "star", label: "со звёздочкой" },
  { kind: "heart", label: "с сердечком" },
  { kind: "none", label: "" },
];

export type Sticker = { index: number; fur: string; accessory: Accessory; name: string };

export const STICKER_COUNT = 24;

export function sticker(i: number): Sticker {
  const index = ((i % STICKER_COUNT) + STICKER_COUNT) % STICKER_COUNT;
  const f = FURS[index % FURS.length];
  const a = ACCESSORIES[(index + Math.floor(index / FURS.length) * 3) % ACCESSORIES.length];
  return { index, fur: f.fur, accessory: a.kind, name: a.label ? `${f.name} ${a.label}` : f.name };
}
