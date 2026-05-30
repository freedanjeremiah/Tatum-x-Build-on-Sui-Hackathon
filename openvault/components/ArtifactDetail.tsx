"use client";

import Link from "next/link";
import { useState } from "react";
import type { Artifact } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import TxLink from "./TxLink";
import { ModalityChip, TierBadge, TierGlyph } from "./ui/TierBadge";
import DownloadButton from "./DownloadButton";
import LineageGraph from "./LineageGraph";
import ReportDialog from "./ReportDialog";
import RoyaltyPanel from "./RoyaltyPanel";
import Icon from "./ui/Icon";

export default function ArtifactDetail({ artifact }: { artifact: Artifact }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);

  const t = tierMeta(artifact.tier);
  const isCompute = artifact.tier === "compute";

  return (
    <div
      className="container maxw-artifact"
      style={{ paddingTop: 26, paddingBottom: 60 }}
    >
      {/* breadcrumb */}
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <Link
          href="/"
          style={{ color: "var(--ov-text-faint)" }}
        >
          Browse
        </Link>{" "}
        / {artifact.modality}
      </div>

      {/* header */}
      <div className="anim-up" style={{ animationDelay: "40ms" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexWrap: "wrap",
          }}
        >
          <TierBadge tier={artifact.tier} />
          <ModalityChip modality={artifact.modality} />
          {disputeId ? (
            <span
              className="tier-badge"
              style={{
                color: "var(--tier-gated)",
                borderColor: "var(--tier-gated)",
                background:
                  "color-mix(in srgb, var(--tier-gated) 12%, transparent)",
              }}
            >
              <span
                className="tier-dot"
                style={{
                  background: "var(--tier-gated)",
                  animation: "ov-pulse-ring 1.4s infinite",
                }}
              />
              In dispute #{disputeId}
            </span>
          ) : null}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setReportOpen(true)}
          >
            <Icon name="flag" size={13} />
            Report
          </button>
        </div>

        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            margin: "16px 0 12px",
            color: "var(--ov-text)",
          }}
        >
          {artifact.title}
        </h1>
        <p
          style={{
            maxWidth: 620,
            fontSize: 14.5,
            color: "var(--ov-text-dim)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {artifact.description}
        </p>
        {artifact.tags?.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 14,
            }}
          >
            {artifact.tags.map((tg) => (
              <span key={tg} className="tag-chip">
                {tg}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <hr className="divider-ink" style={{ margin: "26px 0" }} />

      <div className="ov-detail-grid">
        <div style={{ display: "grid", gap: 18 }}>
          {/* access */}
          <div
            className="panel"
            style={{
              padding: 20,
              borderColor: `color-mix(in srgb, ${t.color} 45%, var(--ov-line-ink))`,
              background: `color-mix(in srgb, ${t.color} 6%, var(--ov-panel))`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 6,
              }}
            >
              <TierGlyph tier={artifact.tier} size={16} />
              <span
                className="h2"
                style={{ fontSize: 16, color: "var(--ov-text)" }}
              >
                Access
              </span>
            </div>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                color: "var(--ov-text-dim)",
              }}
            >
              {t.license}.
            </p>
            {isCompute ? (
              <ComputeCta artifact={artifact} />
            ) : (
              <DownloadButton artifact={artifact} />
            )}
          </div>

          {/* lineage */}
          <div className="panel" style={{ padding: 20 }}>
            <div
              className="h2"
              style={{
                fontSize: 16,
                marginBottom: 16,
                color: "var(--ov-text)",
              }}
            >
              Lineage
            </div>
            <LineageGraph artifact={artifact} />
          </div>

          {/* royalties */}
          {(artifact.tier === "gated" ||
            artifact.tier === "compute" ||
            artifact.tier === "group" ||
            artifact.licenseTermsId) && (
            <RoyaltyPanel artifact={artifact} />
          )}
        </div>

        {/* sidebar */}
        <div
          style={{ display: "grid", gap: 18, alignContent: "start" }}
        >
          <div className="panel" style={{ padding: 18 }}>
            <div className="meta" style={{ marginBottom: 8 }}>
              Provenance
            </div>
            <ProvRow label="IP asset">
              <TxLink ipId={artifact.ipId} />
            </ProvRow>
            <ProvRow label="Created">
              <TxLink hash={artifact.createdTx} />
            </ProvRow>
            {artifact.licenseTermsId ? (
              <ProvRow label="License terms">
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: "var(--ov-text)" }}
                >
                  #{artifact.licenseTermsId}
                </span>
              </ProvRow>
            ) : null}
            {artifact.computeLicenseTermsId ? (
              <ProvRow label="Compute terms">
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: "var(--ov-text)" }}
                >
                  #{artifact.computeLicenseTermsId}
                </span>
              </ProvRow>
            ) : null}
            {artifact.vaultUuid !== undefined ? (
              <ProvRow label="Vault uuid">
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: "var(--ov-text)" }}
                >
                  uuid:{artifact.vaultUuid}
                </span>
              </ProvRow>
            ) : null}
            {artifact.cid ? (
              <ProvRow label="CID">
                <span
                  className="font-mono"
                  style={{ fontSize: 11.5, color: "var(--ov-text)" }}
                >
                  {artifact.cid.length > 22
                    ? `${artifact.cid.slice(0, 10)}…${artifact.cid.slice(-6)}`
                    : artifact.cid}
                </span>
              </ProvRow>
            ) : null}
            {artifact.parentIpId ? (
              <ProvRow label="Parent IP">
                <TxLink ipId={artifact.parentIpId} />
              </ProvRow>
            ) : null}
            {artifact.groupId ? (
              <ProvRow label="Group">
                <TxLink ipId={artifact.groupId} />
              </ProvRow>
            ) : null}
            {artifact.externalSource ? (
              <div style={{ paddingTop: 9 }}>
                <span
                  className="meta"
                  style={{
                    color: "var(--ov-text-faint)",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  OSS source
                </span>
                <a
                  href={artifact.externalSource}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono"
                  style={{
                    fontSize: 11.5,
                    color: "var(--ov-accent)",
                    wordBreak: "break-all",
                  }}
                >
                  {artifact.externalSource.replace("https://", "").slice(0, 38)}
                  {artifact.externalSource.length > 46 ? "…" : ""}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ReportDialog
        artifact={artifact}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onDisputed={(id) => setDisputeId(id)}
      />
    </div>
  );
}

function ProvRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "9px 0",
        borderBottom: "1px solid var(--ov-line-soft)",
      }}
    >
      <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
        {label}
      </span>
      <span style={{ textAlign: "right" }}>{children}</span>
    </div>
  );
}

function ComputeCta({ artifact }: { artifact: Artifact }) {
  const t = tierMeta("compute");
  return (
    <div>
      <div
        style={{
          padding: "9px 12px",
          borderRadius: 10,
          marginBottom: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          letterSpacing: "0.04em",
          color: t.color,
          background: `color-mix(in srgb, ${t.color} 11%, transparent)`,
          border: `1px solid color-mix(in srgb, ${t.color} 32%, transparent)`,
        }}
      >
        Computable, never downloadable
      </div>
      <Link
        href={`/compute/${artifact.ipId}`}
        className="btn"
        style={{
          background: t.color,
          color: "#fff",
          width: "100%",
          boxShadow: "3px 3px 0 var(--ov-navy)",
        }}
      >
        <Icon name="play" size={14} />
        Run a compute job
      </Link>

      {artifact.allowedAlgoHashes && artifact.allowedAlgoHashes.length > 0 ? (
        <>
          <div className="meta" style={{ margin: "16px 0 8px" }}>
            Allowlisted algorithms
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {artifact.allowedAlgoHashes.map((h) => (
              <div
                key={h}
                className="font-mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--ov-text)",
                }}
              >
                <span
                  className="tier-dot"
                  style={{ background: t.color }}
                />
                {h}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
