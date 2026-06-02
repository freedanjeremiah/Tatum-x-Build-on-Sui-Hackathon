import type { Tier } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import Icon from "./Icon";

export function TierBadge({ tier }: { tier: Tier }) {
  const t = tierMeta(tier);
  return (
    <span
      className="tier-badge"
      style={{
        color: t.color,
        borderColor: t.color,
        background: `color-mix(in srgb, ${t.color} 12%, transparent)`,
      }}
    >
      <span className="tier-dot" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

/** Per-tier inline glyph in the tier's color (used in card lock area, etc.). */
export function TierGlyph({ tier, size = 14 }: { tier: Tier; size?: number }) {
  const t = tierMeta(tier);
  const name =
    t.glyph === "arrow"
      ? "arrow"
      : t.glyph === "compute"
        ? "compute"
        : t.glyph === "group"
          ? "layers"
          : "lock";
  return (
    <span style={{ color: t.color, display: "inline-flex" }}>
      <Icon name={name as never} size={size} />
    </span>
  );
}

export function ModalityChip({ modality }: { modality: "dataset" | "model" }) {
  return (
    <span className="chip">{modality === "model" ? "Model" : "Dataset"}</span>
  );
}
