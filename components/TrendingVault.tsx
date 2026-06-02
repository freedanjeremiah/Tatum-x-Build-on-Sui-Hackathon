"use client";

import Link from "next/link";
import type { Artifact, Modality, Tier } from "@/types/artifact";
import { TierBadge } from "./ui/TierBadge";
import Icon, { type IconName } from "./ui/Icon";

export type BrowseIntent = { tier?: Tier; modality?: Modality };

function hrefFor(a: Artifact): string {
  if (a.tier === "compute") return `/compute/${a.ipId}`;
  if (a.tier === "group" && a.groupId) return `/group/${a.groupId}`;
  return `/artifact/${a.ipId}`;
}

function byScore(a: Artifact, b: Artifact): number {
  return (b.score ?? 0) - (a.score ?? 0);
}

type ColumnDef = {
  key: string;
  label: string;
  icon: IconName;
  blurb: string;
  pick: (a: Artifact) => boolean;
  browse: BrowseIntent;
  browseLabel: string;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "datasets",
    label: "Datasets",
    icon: "layers",
    blurb: "Encrypted corpora",
    pick: (a) => a.modality === "dataset",
    browse: { modality: "dataset" },
    browseLabel: "Browse all datasets",
  },
  {
    key: "models",
    label: "Models",
    icon: "vault",
    blurb: "Weights & checkpoints",
    pick: (a) => a.modality === "model",
    browse: { modality: "model" },
    browseLabel: "Browse all models",
  },
  {
    key: "compute",
    label: "Compute-ready",
    icon: "compute",
    blurb: "Run, never download",
    pick: (a) => a.tier === "compute" || a.computeEnabled === true,
    browse: { tier: "compute" },
    browseLabel: "Browse compute vaults",
  },
];

/**
 * "Trending in the vault" — a HuggingFace-style discovery block: three parallel
 * columns (Datasets / Models / Compute-ready), each a compact ranked list of the
 * top artifacts by leaderboard score, with a "Browse all →" affordance that
 * drives the full grid's filter. Reads the unfiltered catalog so it stays stable
 * regardless of what the grid below is filtered to.
 */
export default function TrendingVault({
  artifacts,
  loading,
  onBrowse,
}: {
  artifacts: Artifact[];
  loading: boolean;
  onBrowse: (intent: BrowseIntent) => void;
}) {
  return (
    <section className="anim-up" style={{ marginTop: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <h2
          className="font-display"
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.01em",
            color: "var(--ov-text)",
          }}
        >
          Trending in the vault
        </h2>
        <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
          BY SCORE
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {COLUMNS.map((col) => {
          const items = artifacts.filter(col.pick).sort(byScore).slice(0, 5);
          return (
            <TrendingColumn
              key={col.key}
              col={col}
              items={items}
              loading={loading}
              onBrowse={onBrowse}
            />
          );
        })}
      </div>
    </section>
  );
}

function TrendingColumn({
  col,
  items,
  loading,
  onBrowse,
}: {
  col: ColumnDef;
  items: Artifact[];
  loading: boolean;
  onBrowse: (intent: BrowseIntent) => void;
}) {
  return (
    <div
      className="panel"
      style={{ padding: 16, display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "var(--ov-panel-2)",
            color: "var(--ov-accent)",
            flex: "none",
          }}
        >
          <Icon name={col.icon} size={16} />
        </span>
        <div style={{ lineHeight: 1.15 }}>
          <div
            className="font-display"
            style={{ fontSize: 15, fontWeight: 700, color: "var(--ov-text)" }}
          >
            {col.label}
          </div>
          <div
            className="meta"
            style={{ color: "var(--ov-text-faint)", marginTop: 2 }}
          >
            {col.blurb}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 18, margin: "9px 0", width: `${88 - i * 9}%` }}
            />
          ))
        ) : items.length === 0 ? (
          <p
            style={{
              margin: "8px 0 14px",
              fontSize: 12.5,
              color: "var(--ov-text-faint)",
            }}
          >
            Nothing here yet.
          </p>
        ) : (
          items.map((a, i) => <TrendingRow key={a.ipId} a={a} rank={i + 1} />)
        )}
      </div>

      <button
        type="button"
        onClick={() => onBrowse(col.browse)}
        className="nav-link"
        style={{
          marginTop: 12,
          paddingTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "none",
          border: "none",
          borderTop: "1.5px solid var(--ov-line)",
          cursor: "pointer",
          font: "inherit",
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ov-accent)",
          textAlign: "left",
        }}
      >
        {col.browseLabel}
        <Icon name="arrow" size={13} />
      </button>
    </div>
  );
}

function TrendingRow({ a, rank }: { a: Artifact; rank: number }) {
  return (
    <Link
      href={hrefFor(a)}
      className="trending-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 4px",
        borderBottom: "1px solid var(--ov-line)",
        textDecoration: "none",
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: 12,
          color: "var(--ov-text-faint)",
          width: 16,
          flex: "none",
          textAlign: "right",
        }}
      >
        {rank}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="font-display clamp-1"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ov-text)",
            lineHeight: 1.2,
          }}
        >
          {a.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <TierBadge tier={a.tier} />
          <span
            className="meta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--ov-text-faint)",
            }}
          >
            <Icon name="trophy" size={11} />
            {a.score ?? 0}
          </span>
        </div>
      </div>
      <span
        style={{ color: "var(--ov-text-faint)", display: "inline-flex" }}
        aria-hidden
      >
        <Icon name="arrow" size={13} />
      </span>
    </Link>
  );
}
