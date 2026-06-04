"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import ModelCard from "@/components/ModelCard";
import TxLink from "@/components/TxLink";
import Icon from "@/components/ui/Icon";

const ADDRESS_EXPLORER = "https://suiscan.xyz/testnet/account/";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner } = use(params);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    // State updates live in a nested async fn (not the synchronous effect body)
    // so the loading reset doesn't trigger the set-state-in-effect cascade.
    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/index?owner=${encodeURIComponent(owner)}`, {
          signal: controller.signal,
        });
        const data: Artifact[] = await r.json();
        if (Array.isArray(data)) setArtifacts(data);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== "AbortError") setArtifacts([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [owner]);

  const datasets = artifacts.filter((a) => a.modality === "dataset").length;
  const models = artifacts.filter((a) => a.modality === "model").length;
  const totalScore = artifacts.reduce((s, a) => s + (a.score ?? 0), 0);

  return (
    <div
      className="container maxw-browse"
      style={{ paddingTop: 26, paddingBottom: 60 }}
    >
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <Link href="/" style={{ color: "var(--ov-text-faint)" }}>
          Browse
        </Link>{" "}
        / profile
      </div>

      {/* header */}
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          WALLET PROFILE
        </p>
        <h1
          className="h1 font-mono"
          style={{
            fontSize: "clamp(20px,3vw,30px)",
            wordBreak: "break-all",
            color: "var(--ov-text)",
            margin: "0 0 10px",
          }}
        >
          {owner}
        </h1>
        <a
          href={`${ADDRESS_EXPLORER}${owner}`}
          target="_blank"
          rel="noopener noreferrer"
          className="txlink"
        >
          <span>View on explorer</span>
          <span className="suffix">ADDR</span>
        </a>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 20,
          }}
        >
          <StatChip
            label="Artifacts"
            value={loading ? "—" : String(artifacts.length)}
          />
          <StatChip
            label="Datasets"
            value={loading ? "—" : String(datasets)}
          />
          <StatChip label="Models" value={loading ? "—" : String(models)} />
          <StatChip
            label="Total score"
            value={loading ? "—" : String(totalScore)}
          />
        </div>
      </div>

      {/* artifacts */}
      <section style={{ marginBottom: 40 }}>
        <div
          className="meta"
          style={{ margin: "4px 0 14px", color: "var(--ov-text-faint)" }}
        >
          {loading
            ? "LOADING…"
            : `${artifacts.length} ARTIFACT${artifacts.length === 1 ? "" : "S"}`}
        </div>

        {loading ? (
          <div className="ov-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 256, borderRadius: 18 }}
              />
            ))}
          </div>
        ) : artifacts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="ov-grid">
            {artifacts.map((a) => (
              <ModelCard key={a.ipId} artifact={a} />
            ))}
          </div>
        )}
      </section>

      {/* activity */}
      {!loading && artifacts.length > 0 ? (
        <section>
          <div
            className="meta"
            style={{ margin: "4px 0 14px", color: "var(--ov-text-faint)" }}
          >
            ACTIVITY
          </div>
          <div className="panel" style={{ padding: 6 }}>
            {artifacts.map((a) => (
              <div
                key={a.ipId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 14px",
                  borderBottom: "1px solid var(--ov-line-soft)",
                }}
              >
                <span
                  style={{ color: "var(--ov-text-faint)", display: "inline-flex" }}
                >
                  <Icon name="check" size={14} />
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--ov-text-dim)",
                  }}
                >
                  Registered{" "}
                  <Link
                    href={`/artifact/${a.ipId}`}
                    style={{ color: "var(--ov-text)", fontWeight: 600 }}
                  >
                    {a.title}
                  </Link>
                </span>
                <span style={{ flex: 1 }} />
                <TxLink hash={a.createdTx} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div style={{ height: 40 }} />
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "12px 18px",
        borderRadius: "var(--radius-lg)",
        border: "1.5px solid var(--ov-line)",
        background: "var(--ov-panel)",
        minWidth: 96,
      }}
    >
      <span
        className="font-display"
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "var(--ov-text)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ov-text-faint)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: "2px dashed var(--ov-line-ink)",
        borderRadius: 18,
        padding: "52px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        background: "color-mix(in srgb, var(--ov-panel) 50%, transparent)",
      }}
    >
      <span style={{ color: "var(--ov-text-faint)" }}>
        <Icon name="search" size={30} />
      </span>
      <p
        style={{
          margin: 0,
          color: "var(--ov-text-dim)",
          fontSize: 13,
          maxWidth: 380,
        }}
      >
        No indexed artifacts for this address.
      </p>
    </div>
  );
}
