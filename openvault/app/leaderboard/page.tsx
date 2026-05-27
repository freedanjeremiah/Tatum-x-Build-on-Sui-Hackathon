"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import { TierBadge } from "@/components/ModelCard";
import TxLink from "@/components/TxLink";

/** Kaggle-style leaderboard: artifacts ranked by score (fetched + sorted here). */
export default function LeaderboardPage() {
  const [rows, setRows] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/index", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Artifact[]) => {
        if (!Array.isArray(data)) return;
        const sorted = [...data].sort(
          (a, b) => (b.score ?? 0) - (a.score ?? 0)
        );
        setRows(sorted);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setRows([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      <header className="ov-anim-up py-10 sm:py-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ov-accent)]">
          <TrophyIcon /> Leaderboard
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ov-text)] sm:text-4xl">
          Top artifacts by score
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--ov-text-dim)]">
          Datasets and models ranked by their on-chain usage score. Scores are
          public index metadata; click any IP id to verify provenance.
        </p>
      </header>

      <div role="table" aria-label="Artifact leaderboard" className="ov-anim-up overflow-hidden rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50">
        {/* head */}
        <div role="row" className="grid grid-cols-[48px_1fr_96px_110px_88px_minmax(0,150px)] items-center gap-3 border-b border-[var(--ov-line)] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Modality</span>
          <span>Tier</span>
          <span className="text-right">Score</span>
          <span className="text-right">IP asset</span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[58px] animate-pulse border-b border-[var(--ov-line-soft)] bg-[var(--ov-panel)]/30 last:border-0"
            />
          ))
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-[13px] text-[var(--ov-text-dim)]">
            No ranked artifacts yet.
          </div>
        ) : (
          rows.map((a, i) => <Row key={a.ipId} artifact={a} rank={i + 1} />)
        )}
      </div>
    </div>
  );
}

function Row({ artifact: a, rank }: { artifact: Artifact; rank: number }) {
  const meta = tierMeta(a.tier);
  return (
    <div
      role="row"
      className="group grid grid-cols-[48px_1fr_96px_110px_88px_minmax(0,150px)] items-center gap-3 border-b border-[var(--ov-line-soft)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--ov-panel-2)]/50"
      style={{ "--tier-color": meta.color } as React.CSSProperties}
    >
      <span className="text-center">
        <RankBadge rank={rank} />
      </span>

      <Link
        href={`/artifact/${a.ipId}`}
        className="min-w-0 truncate text-[14px] font-medium text-[var(--ov-text)] transition-colors group-hover:text-[var(--ov-accent)]"
        title={a.title}
      >
        {a.title}
      </Link>

      <span className="text-[12px] capitalize text-[var(--ov-text-dim)]">
        {a.modality}
      </span>

      <span>
        <TierBadge tier={a.tier} />
      </span>

      <span className="text-right font-mono text-[14px] tabular-nums text-[var(--ov-text)]">
        {(a.score ?? 0).toLocaleString()}
      </span>

      <span className="flex justify-end">
        <TxLink ipId={a.ipId} />
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "#f5b942"
      : rank === 2
        ? "#c2cdd8"
        : rank === 3
          ? "#cd8b5f"
          : null;
  if (medal) {
    return (
      <span
        className="inline-grid h-7 w-7 place-items-center rounded-full font-mono text-[12px] font-bold"
        style={{
          color: medal,
          background: `color-mix(in oklab, ${medal} 16%, transparent)`,
          border: `1px solid color-mix(in oklab, ${medal} 40%, transparent)`,
        }}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="inline-block font-mono text-[13px] text-[var(--ov-text-faint)]">
      {rank}
    </span>
  );
}

function TrophyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M6 6H3v1a3 3 0 0 0 3 3M18 6h3v1a3 3 0 0 1-3 3M9 18h6M10 14v4M14 14v4M8 21h8" />
    </svg>
  );
}
