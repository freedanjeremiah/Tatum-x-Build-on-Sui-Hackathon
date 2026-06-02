"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import { TierBadge } from "@/components/ui/TierBadge";
import TxLink from "@/components/TxLink";
import Icon from "@/components/ui/Icon";

/** Kaggle-style leaderboard: artifacts ranked by score. */
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
          (a, b) => (b.score ?? 0) - (a.score ?? 0),
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
    <div
      className="container maxw-leaderboard"
      style={{ paddingTop: 36, paddingBottom: 60 }}
    >
      <div className="anim-up" style={{ marginBottom: 24 }}>
        <span
          className="eyebrow"
          style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
        >
          <span
            style={{ color: "var(--ov-accent)", display: "inline-flex" }}
          >
            <Icon name="trophy" size={13} />
          </span>
          LEADERBOARD
        </span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px,4vw,42px)",
            margin: "10px 0 10px",
            color: "var(--ov-text)",
          }}
        >
          Top artifacts by score
        </h1>
        <p
          style={{
            color: "var(--ov-text-dim)",
            maxWidth: 600,
            fontSize: 14,
            margin: 0,
          }}
        >
          Datasets and models ranked by their on-chain usage score. Scores are
          public index metadata; click any IP id to verify provenance.
        </p>
      </div>

      <div
        role="table"
        aria-label="Artifact leaderboard"
        className="panel"
        style={{ padding: 0, overflow: "hidden" }}
      >
        <div
          role="row"
          className="ov-lb-row"
          style={{
            borderBottom: "1.5px solid var(--ov-line-ink)",
            background: "var(--ov-panel-2)",
          }}
        >
          <span className="meta">#</span>
          <span className="meta">Title</span>
          <span className="meta ov-lb-hide">Modality</span>
          <span className="meta">Tier</span>
          <span className="meta" style={{ textAlign: "right" }}>
            Score
          </span>
          <span className="meta ov-lb-hide" style={{ textAlign: "right" }}>
            IP asset
          </span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ov-lb-row"
              style={{ borderBottom: "1px solid var(--ov-line-soft)" }}
            >
              <div className="skeleton" style={{ height: 16, width: 24 }} />
              <div className="skeleton" style={{ height: 16, width: "60%" }} />
              <div
                className="skeleton ov-lb-hide"
                style={{ height: 16, width: 50 }}
              />
              <div className="skeleton" style={{ height: 16, width: 60 }} />
              <div
                className="skeleton"
                style={{ height: 16, width: 50, marginLeft: "auto" }}
              />
              <div
                className="skeleton ov-lb-hide"
                style={{ height: 16, width: 90, marginLeft: "auto" }}
              />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: 50,
              textAlign: "center",
              color: "var(--ov-text-faint)",
              fontSize: 13,
            }}
          >
            No ranked artifacts yet.
          </div>
        ) : (
          rows.map((a, i) => (
            <Row
              key={a.ipId}
              artifact={a}
              rank={i + 1}
              last={i === rows.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Row({
  artifact: a,
  rank,
  last,
}: {
  artifact: Artifact;
  rank: number;
  last: boolean;
}) {
  return (
    <div
      role="row"
      className="ov-lb-row anim-up"
      style={{
        borderBottom: last ? "none" : "1px solid var(--ov-line-soft)",
        animationDelay: `${Math.min(rank * 35, 280)}ms`,
      }}
    >
      <RankBadge rank={rank} />
      <Link
        href={`/artifact/${a.ipId}`}
        style={{
          fontWeight: 600,
          fontSize: 13.5,
          color: "var(--ov-text)",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ov-accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ov-text)")}
        title={a.title}
      >
        {a.title}
      </Link>
      <span
        className="ov-lb-hide"
        style={{
          fontSize: 12.5,
          color: "var(--ov-text-dim)",
          textTransform: "capitalize",
        }}
      >
        {a.modality}
      </span>
      <span>
        <TierBadge tier={a.tier} />
      </span>
      <span
        className="font-mono tabular"
        style={{
          textAlign: "right",
          fontWeight: 600,
          fontSize: 13.5,
          color: "var(--ov-text)",
        }}
      >
        {(a.score ?? 0).toLocaleString()}
      </span>
      <span className="ov-lb-hide" style={{ textAlign: "right" }}>
        <TxLink ipId={a.ipId} />
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "#d9a52b"
      : rank === 2
        ? "#9aa6b4"
        : rank === 3
          ? "#c07d3e"
          : null;
  if (medal) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: medal,
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
            boxShadow: "1.5px 1.5px 0 var(--ov-navy)",
          }}
        >
          <Icon name="trophy" size={12} />
        </span>
        <span
          className="font-mono tabular"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--ov-text)" }}
        >
          {rank}
        </span>
      </span>
    );
  }
  return (
    <span
      className="font-mono tabular"
      style={{
        fontSize: 13,
        color: "var(--ov-text-dim)",
        paddingLeft: 6,
      }}
    >
      {rank}
    </span>
  );
}
