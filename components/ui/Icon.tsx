import type { CSSProperties } from "react";

/**
 * Stroke-only icon set used across Reef. 2px stroke, rounded caps, no
 * filled glyphs except the small triangular `play` and `bolt` shapes. Adding
 * an icon: keep the 24×24 viewBox and the same stroke conventions.
 */
export type IconName =
  | "lock"
  | "vault"
  | "arrow"
  | "compute"
  | "search"
  | "flag"
  | "check"
  | "chevron"
  | "chevronUp"
  | "key"
  | "plus"
  | "refresh"
  | "shield"
  | "external"
  | "copy"
  | "upload"
  | "download"
  | "trophy"
  | "close"
  | "play"
  | "bolt"
  | "layers";

interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export default function Icon({ name, size = 16, style, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  lock: (
    <>
      <rect x={4} y={10.5} width={16} height={10} rx={2.2} />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <circle cx={12} cy={15.4} r={1.2} />
    </>
  ),
  vault: (
    <>
      <rect x={3.5} y={4} width={17} height={16} rx={2.4} />
      <circle cx={12} cy={12} r={3.4} />
      <path d="M12 8.6V6.4M12 17.6v-2.2M8.6 12H6.4M17.6 12h-2.2" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  compute: (
    <>
      <rect x={4} y={4} width={16} height={16} rx={2} />
      <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
    </>
  ),
  search: (
    <>
      <circle cx={11} cy={11} r={7} />
      <path d="m20 20-3.2-3.2" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  check: <path d="M5 12.5l4.5 4.5L19 6.5" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  key: (
    <>
      <circle cx={8} cy={14} r={4} />
      <path d="M11 11l8-8M16 6l2 2M14 8l2 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.2M4 4v3h3" />
      <path d="M4 13a8 8 0 0 0 14.3 4.2M20 20v-3h-3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z" />
      <path d="M9.5 12l1.8 1.8L15 9.8" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </>
  ),
  copy: (
    <>
      <rect x={9} y={9} width={11} height={11} rx={2} />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 17h6M10 13.5V17M14 13.5V17M8 20h8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M7 5l11 7-11 7z" />,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  layers: (
    <>
      <path d="M12 3l8 4.5-8 4.5-8-4.5z" />
      <path d="M4 12l8 4.5 8-4.5" />
      <path d="M4 16.5l8 4.5 8-4.5" />
    </>
  ),
};
