import { sticker } from "@/lib/stickers";

const INK = "#4A3366";
const PINK = "#FFB4C8";

/** A round die-cut cat sticker. `index` picks the cat; `bare` draws only the cat, without the white sticker edge. */
export default function CatSticker({ index, size = 64, bare = false, className = "" }: { index: number; size?: number; bare?: boolean; className?: string }) {
  const s = sticker(index);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={s.name}>
      {!bare && <circle cx="60" cy="62" r="56" fill="#fff" stroke="#EADCF7" strokeWidth="2" />}
      <g transform="translate(6 16) scale(0.9)">
        <path d="M18 46 L14 6 L46 26 Z" fill={s.fur} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M102 46 L106 6 L74 26 Z" fill={s.fur} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M22 30 L20 16 L34 25 Z" fill={PINK} />
        <path d="M98 30 L100 16 L86 25 Z" fill={PINK} />
        <ellipse cx="60" cy="58" rx="50" ry="38" fill={s.fur} stroke={INK} strokeWidth="4" />
        <ellipse cx="40" cy="56" rx="5" ry="7" fill={INK} />
        <ellipse cx="80" cy="56" rx="5" ry="7" fill={INK} />
        <circle cx="42" cy="53" r="2" fill="#fff" />
        <circle cx="82" cy="53" r="2" fill="#fff" />
        <ellipse cx="28" cy="70" rx="8" ry="5" fill={PINK} />
        <ellipse cx="92" cy="70" rx="8" ry="5" fill={PINK} />
        <path d="M52 66 Q56 72 60 66 Q64 72 68 66" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M57 62 L63 62 L60 65 Z" fill="#E8798F" />
        <Accessory kind={s.accessory} />
      </g>
    </svg>
  );
}

function Accessory({ kind }: { kind: string }) {
  switch (kind) {
    case "bow":
      return (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round" transform="translate(86 22) rotate(-15)">
          <path d="M0 0 L-18 -11 L-18 11 Z" fill="#FF7BAC" />
          <path d="M0 0 L18 -11 L18 11 Z" fill="#FF7BAC" />
          <circle r="5.5" fill="#FF4F93" />
        </g>
      );
    case "crown":
      return <path d="M38 22 L42 2 L52 14 L60 0 L68 14 L78 2 L82 22 Z" fill="#FFD447" stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
    case "glasses":
      return (
        <g fill="none" stroke={INK} strokeWidth="3">
          <circle cx="40" cy="56" r="12" fill="#ffffff55" />
          <circle cx="80" cy="56" r="12" fill="#ffffff55" />
          <path d="M52 56 L68 56" />
        </g>
      );
    case "flower":
      return (
        <g transform="translate(36 36) scale(0.75)" stroke={INK} strokeWidth="3">
          {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-8" rx="6" ry="8" fill="#FFD1E3" transform={`rotate(${r})`} />)}
          <circle r="5" fill="#FFD447" />
        </g>
      );
    case "hat":
      return (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M44 22 L60 -12 L76 22 Z" fill="#9EDBFF" />
          <path d="M50 10 L70 10" stroke="#FF7BAC" strokeWidth="4" />
          <circle cx="60" cy="-12" r="5" fill="#FFD447" />
        </g>
      );
    case "star":
      return <path d="M98 2 L102 13 L114 13 L104 20 L108 32 L98 25 L88 32 L92 20 L82 13 L94 13 Z" fill="#FFD447" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />;
    case "heart":
      return <path d="M98 92 C88 82 80 76 86 68 C90 63 96 65 98 70 C100 65 106 63 110 68 C116 76 108 82 98 92 Z" fill="#FF5C8A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />;
    default:
      return null;
  }
}
