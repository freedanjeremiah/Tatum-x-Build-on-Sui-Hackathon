"use client";

import Link from "next/link";
import type { Artifact, Tier } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import TxLink from "./TxLink";

/** CTA copy + intent per tier. */
function cta(a: Artifact): { label: string; emphasis: boolean } {
  switch (a.tier) {
    case "gated":
      return { label: "Mint to unlock", emphasis: true };
    case "compute":
      return { label: "Run a job", emphasis: true };
    case "public":
      return { label: "Download", emphasis: true };
    case "group":
      return { label: "View group", emphasis: false };
    case "private":
    default:
      return { label: "Owner only", emphasis: false };
  }
}

function licenseSummary(a: Artifact): string | null {
  if (a.computeEnabled) return "Compute license · pay per job";
  if (a.tier === "gated") return "Commercial · mint to unlock";
  if (a.licenseTermsId) return "Commercial · license attached";
  return null;
}

export default function ModelCard({ artifact: a }: { artifact: Artifact }) {
  const meta = tierMeta(a.tier);
  const action = cta(a);
  const license = licenseSummary(a);
  const isCompute = a.tier === "compute";

  return (
    <Link
      href={`/artifact/${a.ipId}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/70 p-px transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--tier-color)_55%,var(--ov-line))] hover:shadow-[0_8px_40px_-12px_var(--tier-glow)]"
      style={
        {
          "--tier-color": meta.color,
          "--tier-glow": `color-mix(in oklab, ${meta.color} 30%, transparent)`,
        } as React.CSSProperties
      }
    >
      {/* tier accent rail */}
      <span
        className="absolute inset-y-0 left-0 w-[3px] opacity-70 transition-opacity group-hover:opacity-100"
        style={{ background: meta.color }}
      />

      <div className="flex flex-1 flex-col gap-3.5 rounded-[11px] bg-[var(--ov-panel)] p-4">
        {/* header row: tier badge + modality + report */}
        <div className="flex items-center gap-2">
          <TierBadge tier={a.tier} />
          <ModalityChip modality={a.modality} />
          <button
            type="button"
            title="Report this artifact"
            aria-label="Report this artifact"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="ml-auto rounded-md px-1.5 py-1 text-[var(--ov-text-faint)] opacity-0 transition-all hover:text-[var(--tier-gated)] group-hover:opacity-100"
          >
            <FlagIcon />
          </button>
        </div>

        {/* title + description */}
        <div className="space-y-1.5">
          <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[var(--ov-text)]">
            {a.title}
          </h3>
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-[var(--ov-text-dim)]">
            {a.description}
          </p>
        </div>

        {/* tags */}
        {a.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {a.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-md border border-[var(--ov-line-soft)] bg-[var(--ov-bg-elev)]/60 px-2 py-0.5 font-mono text-[10px] text-[var(--ov-text-faint)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* compute distinction */}
        {isCompute && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--tier-compute)]/30 bg-[var(--tier-compute)]/8 px-2.5 py-1.5">
            <ComputeIcon />
            <span className="text-[11px] font-medium text-[var(--tier-compute)]">
              Computable · not downloadable
            </span>
          </div>
        )}

        {/* license + provenance */}
        <div className="mt-auto space-y-2.5 pt-1">
          {license && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--ov-text-dim)]">
              <LockGlyph tier={a.tier} />
              <span>{license}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <TxLink ipId={a.ipId} />
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                action.emphasis
                  ? "text-[var(--ov-accent-ink)]"
                  : "border border-[var(--ov-line)] text-[var(--ov-text-dim)]"
              }`}
              style={
                action.emphasis
                  ? { background: meta.color }
                  : undefined
              }
            >
              {action.label}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const meta = tierMeta(tier);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        color: meta.color,
        background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${meta.color} 35%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.label}
    </span>
  );
}

function ModalityChip({ modality }: { modality: "dataset" | "model" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ov-line-soft)] px-2 py-0.5 text-[10px] text-[var(--ov-text-faint)]">
      {modality === "dataset" ? <DatasetIcon /> : <ModelIcon />}
      {modality}
    </span>
  );
}

function LockGlyph({ tier }: { tier: Tier }) {
  if (tier === "compute") return <ComputeIcon small />;
  if (tier === "public")
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--tier-public)]" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--ov-text-faint)]" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ComputeIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--tier-compute)]" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9 1.5v3M15 1.5v3M9 19.5v3M15 19.5v3M1.5 9h3M1.5 15h3M19.5 9h3M19.5 15h3" strokeLinecap="round" />
    </svg>
  );
}

function DatasetIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <path d="M10.5 6.8 6.5 16M13.5 6.8 17.5 16M7 18h10" strokeLinecap="round" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V4M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}
