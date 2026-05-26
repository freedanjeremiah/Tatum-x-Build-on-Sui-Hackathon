"use client";

import { useEffect, useState } from "react";
import type { Artifact, Tier, Modality } from "@/types/artifact";
import { TIER_ORDER, tierMeta } from "@/lib/tiers";
import ModelCard from "@/components/ModelCard";

export default function BrowsePage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state — React state only, never persisted.
  const [tier, setTier] = useState<Tier | null>(null);
  const [modality, setModality] = useState<Modality | "">("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tier) params.set("tier", tier);
    if (modality) params.set("modality", modality);
    if (q.trim()) params.set("q", q.trim());

    setLoading(true);
    fetch(`/api/index?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Artifact[]) => {
        if (Array.isArray(data)) setArtifacts(data);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setArtifacts([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [tier, modality, q]);

  return (
    <div className="mx-auto max-w-[1400px] px-5">
      <Hero />

      {/* filter bar */}
      <div className="ov-anim-up sticky top-14 z-20 -mx-5 mb-6 border-y border-[var(--ov-line)] bg-[var(--ov-bg)]/85 px-5 py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* tier chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <TierChip
              active={tier === null}
              label="All"
              onClick={() => setTier(null)}
            />
            {TIER_ORDER.map((t) => (
              <TierChip
                key={t}
                tier={t}
                active={tier === t}
                label={tierMeta(t).label}
                onClick={() => setTier(tier === t ? null : t)}
              />
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value as Modality | "")}
              className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-panel)] px-3 py-1.5 text-[13px] text-[var(--ov-text)] outline-none focus:border-[var(--ov-accent)]"
            >
              <option value="">All modalities</option>
              <option value="dataset">Datasets</option>
              <option value="model">Models</option>
            </select>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ov-text-faint)]">
                <SearchIcon />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, tags…"
                className="w-56 rounded-lg border border-[var(--ov-line)] bg-[var(--ov-panel)] py-1.5 pl-9 pr-3 text-[13px] text-[var(--ov-text)] outline-none placeholder:text-[var(--ov-text-faint)] focus:border-[var(--ov-accent)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* results */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--ov-text-faint)]">
          {loading ? "Loading…" : `${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {loading ? (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      ) : artifacts.length === 0 ? (
        <EmptyState />
      ) : (
        <Grid>
          {artifacts.map((a, i) => (
            <div
              key={a.ipId}
              className="ov-anim-up"
              style={{ animationDelay: `${Math.min(i * 45, 300)}ms` }}
            >
              <ModelCard artifact={a} />
            </div>
          ))}
        </Grid>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="ov-anim-up py-12 sm:py-16">
      <div className="max-w-3xl space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ov-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-accent)]" />
          Story · Confidential Data Registry
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ov-text)] sm:text-5xl">
          Access control as a{" "}
          <span className="text-[var(--ov-accent)]">property of the data.</span>
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-[var(--ov-text-dim)]">
          A hub for datasets and models that are encrypted once and gated by
          license — download, mint to unlock, or run confidential jobs without
          ever moving the bytes.
        </p>
      </div>

      {/* tier legend */}
      <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
        {TIER_ORDER.map((t) => {
          const m = tierMeta(t);
          return (
            <div key={t} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: m.color }}
              />
              <span className="text-[12px] font-medium text-[var(--ov-text)]">
                {m.label}
              </span>
              <span className="text-[12px] text-[var(--ov-text-faint)]">
                {m.blurb}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function TierChip({
  tier,
  active,
  label,
  onClick,
}: {
  tier?: Tier;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const color = tier ? tierMeta(tier).color : "var(--ov-accent)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all"
      style={{
        color: active ? (tier ? color : "var(--ov-accent-ink)") : "var(--ov-text-dim)",
        background: active
          ? tier
            ? `color-mix(in oklab, ${color} 16%, transparent)`
            : "var(--ov-accent)"
          : "transparent",
        borderColor: active
          ? `color-mix(in oklab, ${color} 45%, transparent)`
          : "var(--ov-line)",
      }}
    >
      {label}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="h-64 animate-pulse rounded-xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/40" />
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--ov-line)] py-20 text-center">
      <div className="text-[var(--ov-text-faint)]">
        <SearchIcon large />
      </div>
      <p className="text-sm font-medium text-[var(--ov-text)]">
        No artifacts match these filters
      </p>
      <p className="text-[13px] text-[var(--ov-text-dim)]">
        Try clearing the tier or modality, or searching a different term.
      </p>
    </div>
  );
}

function SearchIcon({ large }: { large?: boolean }) {
  const s = large ? 28 : 15;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
