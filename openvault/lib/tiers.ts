import type { Tier } from "@/types/artifact";

// Single source of truth for tier presentation. The hex values mirror the
// --tier-* CSS variables in app/globals.css.
export interface TierMeta {
  label: string;
  color: string; // accent hex
  /** Short one-liner about what access means for this tier. */
  blurb: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  public: {
    label: "Public",
    color: "#34d399",
    blurb: "Open · browse and download freely",
  },
  private: {
    label: "Private",
    color: "#8da2b5",
    blurb: "Owner-only · threshold-encrypted",
  },
  gated: {
    label: "Gated",
    color: "#f5b942",
    blurb: "License-gated · mint a token to decrypt",
  },
  group: {
    label: "Group",
    color: "#a78bfa",
    blurb: "Shared revenue · group-pool members",
  },
  compute: {
    label: "Compute",
    color: "#22d3ee",
    blurb: "Computable · run jobs, never download",
  },
};

export const TIER_ORDER: Tier[] = [
  "public",
  "gated",
  "compute",
  "group",
  "private",
];

export function tierMeta(tier: Tier): TierMeta {
  return TIER_META[tier] ?? TIER_META.public;
}
