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
 * Five selectable tier cards. Selected card adopts the tier's accent color via
 * the same color-mix treatment used across the app (ModelCard / TierBadge).
 * Controlled component.
 */
export default function TierPicker({ value, onChange, tiers }: TierPickerProps) {
  const list = tiers ?? TIER_ORDER;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((tier) => {
        const meta = tierMeta(tier);
        const selected = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            aria-pressed={selected}
            className="group relative flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5"
            style={{
              borderColor: selected
                ? `color-mix(in oklab, ${meta.color} 55%, var(--ov-line))`
                : "var(--ov-line)",
              background: selected
                ? `color-mix(in oklab, ${meta.color} 12%, var(--ov-panel))`
                : "color-mix(in oklab, var(--ov-panel) 70%, transparent)",
              boxShadow: selected
                ? `0 8px 36px -14px color-mix(in oklab, ${meta.color} 60%, transparent)`
                : undefined,
            }}
          >
            <span
              className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl transition-opacity"
              style={{
                background: meta.color,
                opacity: selected ? 1 : 0.35,
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: meta.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.color }}
                />
                {meta.label}
              </span>
              <span
                className="grid h-4 w-4 place-items-center rounded-full border transition-colors"
                style={{
                  borderColor: selected
                    ? meta.color
                    : "var(--ov-line)",
                  background: selected ? meta.color : "transparent",
                }}
              >
                {selected && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--ov-accent-ink)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-[var(--ov-text-dim)]">
              {meta.blurb}
            </p>
          </button>
        );
      })}
    </div>
  );
}
