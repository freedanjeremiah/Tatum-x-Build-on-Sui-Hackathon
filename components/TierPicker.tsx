"use client";

import type { Tier } from "@/types/artifact";
import { TIER_ORDER, tierMeta } from "@/lib/tiers";

interface TierPickerProps {
  value: Tier | null;
  onChange: (tier: Tier) => void;
  /** Optionally restrict the offered tiers (e.g. hide group from the wizard). */
  tiers?: Tier[];
}

/**
 * Five selectable tier mini-cards in the MECHATONE language: square dot in the
 * tier's color, navy/orange offset shadow when selected.
 */
export default function TierPicker({ value, onChange, tiers }: TierPickerProps) {
  const list = tiers ?? TIER_ORDER;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))",
        gap: 10,
      }}
    >
      {list.map((tier) => {
        const meta = tierMeta(tier);
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            aria-pressed={active}
            style={{
              textAlign: "left",
              padding: 14,
              borderRadius: 14,
              cursor: "pointer",
              border: `1.5px solid ${active ? meta.color : "var(--ov-line)"}`,
              background: active
                ? `color-mix(in srgb, ${meta.color} 12%, var(--ov-panel))`
                : "var(--ov-panel)",
              boxShadow: active ? `3px 3px 0 ${meta.color}` : "none",
              transition: "all .14s",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: meta.color,
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: "var(--ov-text)",
                }}
              >
                {meta.label}
              </span>
            </span>
            <span
              style={{ fontSize: 11.5, color: "var(--ov-text-dim)" }}
            >
              {meta.blurb}
            </span>
          </button>
        );
      })}
    </div>
  );
}
