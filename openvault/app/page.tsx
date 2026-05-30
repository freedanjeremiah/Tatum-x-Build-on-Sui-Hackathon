"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact, Modality, Tier } from "@/types/artifact";
import { TIER_ORDER, tierMeta } from "@/lib/tiers";
import ModelCard from "@/components/ModelCard";
import Dropdown from "@/components/ui/Dropdown";
import Icon from "@/components/ui/Icon";

const FILTER_TIERS: Array<Tier | "all"> = [
  "all",
  "public",
  "gated",
  "compute",
  "group",
  "private",
];

export default function BrowsePage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  const [tier, setTier] = useState<Tier | "all">("all");
  const [modality, setModality] = useState<Modality | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tier !== "all") params.set("tier", tier);
    if (modality !== "all") params.set("modality", modality);
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

  const filtered = tier !== "all" || modality !== "all" || q.trim() !== "";

  return (
    <div className="container maxw-browse">
      <Hero />
      <FilterBar
        tier={tier}
        setTier={setTier}
        modality={modality}
        setModality={setModality}
        q={q}
        setQ={setQ}
      />

      <div
        className="meta"
        style={{ margin: "20px 0 14px", color: "var(--ov-text-faint)" }}
      >
        {loading
          ? "LOADING…"
          : `${artifacts.length} ARTIFACT${artifacts.length === 1 ? "" : "S"}`}
      </div>

      {loading ? (
        <div className="ov-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : artifacts.length === 0 ? (
        <EmptyState
          filtered={filtered}
          onClear={() => {
            setTier("all");
            setModality("all");
            setQ("");
          }}
        />
      ) : (
        <div className="ov-grid">
          {artifacts.map((a) => (
            <ModelCard key={a.ipId} artifact={a} />
          ))}
        </div>
      )}

      <div style={{ height: 56 }} />
    </div>
  );
}

function Hero() {
  return (
    <section style={{ position: "relative", paddingTop: 46, paddingBottom: 34 }}>
      <div
        className="anim-up"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 18,
        }}
      >
        <span
          className="tier-dot"
          style={{ background: "var(--ov-accent)" }}
        />
        <span className="eyebrow">STORY · CONFIDENTIAL DATA REGISTRY</span>
      </div>
      <div
        className="anim-up font-jp"
        style={{
          fontSize: 14,
          letterSpacing: "0.3em",
          color: "var(--ov-accent)",
          marginBottom: 12,
          animationDelay: "40ms",
        }}
      >
        コンフィデンシャル データ レジストリ
      </div>
      <h1
        className="h1 anim-up"
        style={{ maxWidth: 880, animationDelay: "80ms" }}
      >
        Access control as a
        <br />
        <span style={{ color: "var(--ov-accent)" }}>
          property of the data.
        </span>
      </h1>
      <p
        className="anim-up"
        style={{
          maxWidth: 560,
          marginTop: 16,
          fontSize: 14.5,
          color: "var(--ov-text-dim)",
          lineHeight: 1.6,
          animationDelay: "120ms",
        }}
      >
        Datasets and models registered as Story IP Assets, threshold-encrypted on
        IPFS. The license token <em>is</em> the decryption credential — there is
        no auth server.
      </p>

      <div
        className="anim-up"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 26,
          animationDelay: "160ms",
        }}
      >
        {TIER_ORDER.map((k) => {
          const t = tierMeta(k);
          return (
            <div
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 13px",
                borderRadius: 999,
                border: "1.5px solid var(--ov-line)",
                background: "var(--ov-panel)",
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: t.color,
                  flex: "none",
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 12.5,
                  color: "var(--ov-text)",
                }}
              >
                {t.label}
              </span>
              <span
                style={{ fontSize: 12, color: "var(--ov-text-faint)" }}
              >
                {t.blurb}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FilterBar({
  tier,
  setTier,
  modality,
  setModality,
  q,
  setQ,
}: {
  tier: Tier | "all";
  setTier: (t: Tier | "all") => void;
  modality: Modality | "all";
  setModality: (m: Modality | "all") => void;
  q: string;
  setQ: (q: string) => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 62,
        zIndex: 30,
        background: "color-mix(in srgb, var(--ov-bg) 88%, transparent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1.5px solid var(--ov-line)",
        margin: "0 -20px",
        padding: "12px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {FILTER_TIERS.map((k) => {
            const active = tier === k;
            const t = k === "all" ? null : tierMeta(k);
            const col = t ? t.color : "var(--ov-navy)";
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTier(k)}
                className="font-mono"
                style={{
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  cursor: "pointer",
                  fontWeight: 600,
                  borderColor: active ? col : "var(--ov-line)",
                  color: active
                    ? k === "all"
                      ? "var(--ov-accent-ink)"
                      : col
                    : "var(--ov-text-dim)",
                  background: active
                    ? k === "all"
                      ? "var(--ov-navy)"
                      : `color-mix(in srgb, ${col} 14%, transparent)`
                    : "transparent",
                }}
              >
                {k === "all" ? "All" : t!.label}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <Dropdown<Modality | "all">
          value={modality}
          onChange={setModality}
          minWidth={150}
          align="right"
          options={[
            { value: "all", label: "All modalities" },
            { value: "dataset", label: "Datasets" },
            { value: "model", label: "Models" },
          ]}
        />
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ov-text-faint)",
              display: "inline-flex",
            }}
          >
            <Icon name="search" size={15} />
          </span>
          <input
            className="input"
            placeholder="Search title, tags, description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 248, paddingLeft: 33, fontSize: 12.5 }}
          />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="panel-soft"
      style={{
        height: 256,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="skeleton" style={{ height: 18, width: 120 }} />
      <div
        className="skeleton"
        style={{ height: 22, width: "70%", marginTop: 4 }}
      />
      <div className="skeleton" style={{ height: 12, width: "100%" }} />
      <div className="skeleton" style={{ height: 12, width: "85%" }} />
      <div style={{ flex: 1 }} />
      <div className="skeleton" style={{ height: 30, width: "100%" }} />
    </div>
  );
}

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
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
      <div
        className="font-display"
        style={{
          alignSelf: "stretch",
          textAlign: "center",
          fontSize: 20,
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--ov-text)",
        }}
      >
        {filtered
          ? "No artifacts match these filters"
          : "No artifacts published yet"}
      </div>
      <p
        style={{
          margin: 0,
          color: "var(--ov-text-dim)",
          fontSize: 13,
          maxWidth: 380,
        }}
      >
        {filtered
          ? "Try a broader tier or clear your search to see everything in the vault."
          : "This is a fresh testnet vault. Register the first dataset or model to see it appear here."}
      </p>
      {filtered ? (
        <button
          type="button"
          className="btn btn-accent"
          style={{ marginTop: 6 }}
          onClick={onClear}
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/upload"
          className="btn btn-accent"
          style={{ marginTop: 6 }}
        >
          Register an artifact
        </Link>
      )}
    </div>
  );
}
