"use client";

import { useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import TxLink from "./TxLink";
import { TierBadge } from "./ModelCard";
import DownloadButton from "./DownloadButton";
import LineageGraph from "./LineageGraph";
import ReportDialog from "./ReportDialog";

export default function ArtifactDetail({ artifact }: { artifact: Artifact }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);

  const meta = tierMeta(artifact.tier);
  const isCompute = artifact.tier === "compute";

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24">
      {/* breadcrumb */}
      <div className="ov-anim-up flex items-center gap-2 pt-6 text-[12px] text-[var(--ov-text-faint)]">
        <Link href="/" className="transition-colors hover:text-[var(--ov-text)]">
          Browse
        </Link>
        <span>/</span>
        <span className="text-[var(--ov-text-dim)]">{artifact.modality}</span>
      </div>

      {/* header */}
      <header className="ov-anim-up mt-4 flex flex-col gap-4 border-b border-[var(--ov-line)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={artifact.tier} />
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ov-line-soft)] px-2 py-0.5 text-[10px] capitalize text-[var(--ov-text-faint)]">
            {artifact.modality}
          </span>
          {disputeId && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--tier-gated)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tier-gated)]" />
              In dispute #{disputeId}
            </span>
          )}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--ov-line)] px-3 py-1.5 text-[12px] text-[var(--ov-text-dim)] transition-colors hover:border-[var(--tier-gated)]/50 hover:text-[var(--tier-gated)]"
          >
            <FlagIcon />
            Report
          </button>
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--ov-text)]">
          {artifact.title}
        </h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--ov-text-dim)]">
          {artifact.description}
        </p>

        {artifact.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {artifact.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-[var(--ov-line-soft)] bg-[var(--ov-bg-elev)]/60 px-2 py-0.5 font-mono text-[10px] text-[var(--ov-text-faint)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* main column */}
        <div className="ov-anim-up space-y-6">
          {/* access / action */}
          <section
            className="rounded-2xl border p-5"
            style={{
              borderColor: `color-mix(in oklab, ${meta.color} 30%, var(--ov-line))`,
              background: `color-mix(in oklab, ${meta.color} 6%, var(--ov-panel))`,
            }}
          >
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
              Access
            </h2>
            <p className="mb-4 text-[12.5px] text-[var(--ov-text-dim)]">
              {meta.blurb}
            </p>

            {isCompute ? (
              <ComputeCta artifact={artifact} />
            ) : (
              <DownloadButton artifact={artifact} />
            )}
          </section>

          {/* lineage */}
          <section className="rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50 p-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
              Lineage
            </h2>
            <LineageGraph artifact={artifact} />
          </section>
        </div>

        {/* sidebar: provenance */}
        <aside className="ov-anim-up space-y-3">
          <div className="rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50 p-4">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
              Provenance
            </h2>
            <dl className="space-y-3">
              <SideRow label="IP asset">
                <TxLink ipId={artifact.ipId} />
              </SideRow>
              <SideRow label="Created">
                <TxLink hash={artifact.createdTx} />
              </SideRow>
              {artifact.licenseTermsId && (
                <SideRow label="License terms">
                  <span className="font-mono text-[12px] text-[var(--ov-text-dim)]">
                    {artifact.licenseTermsId}
                  </span>
                </SideRow>
              )}
              {artifact.computeLicenseTermsId && (
                <SideRow label="Compute terms">
                  <span className="font-mono text-[12px] text-[var(--ov-text-dim)]">
                    {artifact.computeLicenseTermsId}
                  </span>
                </SideRow>
              )}
              {artifact.parentIpId && (
                <SideRow label="Parent IP">
                  <TxLink ipId={artifact.parentIpId} />
                </SideRow>
              )}
              {artifact.groupId && (
                <SideRow label="Group">
                  <TxLink ipId={artifact.groupId} />
                </SideRow>
              )}
              {artifact.externalSource && (
                <SideRow label="OSS source">
                  <a
                    href={artifact.externalSource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-[12px] text-[var(--ov-accent)] underline-offset-2 hover:underline"
                  >
                    {artifact.externalSource}
                  </a>
                </SideRow>
              )}
            </dl>
          </div>
        </aside>
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

function ComputeCta({ artifact }: { artifact: Artifact }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--tier-compute)]/30 bg-[var(--tier-compute)]/8 px-3 py-2.5">
        <ComputeIcon />
        <p className="text-[12px] leading-relaxed text-[var(--ov-text-dim)]">
          This artifact is{" "}
          <span className="font-medium text-[var(--tier-compute)]">
            computable, never downloadable
          </span>
          . The data never leaves the enclave — run a confidential job instead.
        </p>
      </div>

      <Link
        href={`/compute/${artifact.ipId}`}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-all"
        style={{
          background: "var(--tier-compute)",
          color: "var(--ov-accent-ink)",
        }}
      >
        <ComputeIcon ink />
        Run a compute job
      </Link>

      {artifact.allowedAlgoHashes && artifact.allowedAlgoHashes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
            Allowed algorithms
          </span>
          <ul className="flex flex-col gap-1.5">
            {artifact.allowedAlgoHashes.map((a) => (
              <li
                key={a}
                className="flex items-center gap-2 rounded-lg border border-[var(--ov-line-soft)] bg-[var(--ov-bg-elev)]/50 px-3 py-1.5 font-mono text-[12px] text-[var(--ov-text-dim)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--tier-compute)]" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SideRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--ov-text-faint)]">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function ComputeIcon({ ink }: { ink?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink ? "var(--ov-accent-ink)" : "var(--tier-compute)"}
      strokeWidth="2"
      className="mt-0.5 shrink-0"
      aria-hidden
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9 1.5v3M15 1.5v3M9 19.5v3M15 19.5v3M1.5 9h3M1.5 15h3M19.5 9h3M19.5 15h3" strokeLinecap="round" />
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
