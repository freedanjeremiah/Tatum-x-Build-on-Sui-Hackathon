import type { Tier } from "@/types/artifact";

/**
 * Single source of truth for tier presentation. Hex values mirror the
 * `--tier-*` CSS variables in app/globals.css. The MECHATONE reskin uses a
 * restrained 2-ink + slate system: tiers are told apart by glyph + label, not
 * by a competing rainbow of hues.
 */
export type TierGlyph = "arrow" | "lock" | "compute" | "group";

export interface TierMeta {
  label: string;
  /** CSS color (hex). Use `var(--tier-<key>)` in CSS-only contexts. */
  color: string;
  /** Short one-liner about what access means. */
  blurb: string;
  /** Inline icon name used in cards / locks. */
  glyph: TierGlyph;
  /** Default action label on the card / detail page. */
  cta: string;
  /** License summary line shown on the card footer. */
  license: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  public: {
    label: "Public",
    color: "#e8472b",
    blurb: "Open · browse and download freely",
    glyph: "arrow",
    cta: "Download",
    license: "Commercial · license attached",
  },
  private: {
    label: "Private",
    color: "#7d8aa0",
    blurb: "Owner-only · threshold-encrypted",
    glyph: "lock",
    cta: "Owner only",
    license: "Owner only",
  },
  gated: {
    label: "Gated",
    color: "#21356c",
    blurb: "License-gated · mint a token to decrypt",
    glyph: "lock",
    cta: "Mint to unlock",
    license: "Commercial · mint to unlock",
  },
  group: {
    label: "Group",
    color: "#21356c",
    blurb: "Shared revenue · group-pool members",
    glyph: "group",
    cta: "View group",
    license: "Group license · subscribe",
  },
  compute: {
    label: "Compute",
    color: "#21356c",
    blurb: "Computable · run jobs, never download",
    glyph: "compute",
    cta: "Run a job",
    license: "Compute license · pay per job",
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
