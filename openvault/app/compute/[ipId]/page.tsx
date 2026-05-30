// Compute page. Loads the dataset's PUBLIC index record (index-only — no keys,
// no plaintext) and renders the allowlist + run panel. There is NO download path
// anywhere on this page: a compute artifact is computable, never downloadable.

export const runtime = "nodejs";

import Link from "next/link";
import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import { ModalityChip, TierBadge } from "@/components/ui/TierBadge";
import TxLink from "@/components/TxLink";
import AlgoAllowlist from "@/components/AlgoAllowlist";
import ComputeJobPanel from "@/components/ComputeJobPanel";

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function ComputePage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;

  if (!artifact) {
    return (
      <Notice
        title="No artifact with that ID"
        body={`The IP asset ${ipId} is not in the index.`}
      />
    );
  }
  if (artifact.tier !== "compute") {
    return (
      <Notice
        title="Not a compute artifact"
        body="This artifact is not a confidential-compute dataset. Open its detail page to download or mint a license instead."
        backHref={`/artifact/${artifact.ipId}`}
        backLabel="Open artifact"
      />
    );
  }

  return (
    <div
      className="container maxw-compute"
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
        /{" "}
        <Link
          href={`/artifact/${artifact.ipId}`}
          style={{ color: "var(--ov-text-faint)" }}
        >
          {artifact.modality}
        </Link>{" "}
        / compute
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
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--tier-compute)",
              border:
                "1px solid color-mix(in srgb, var(--tier-compute) 35%, transparent)",
              background:
                "color-mix(in srgb, var(--tier-compute) 11%, transparent)",
              padding: "4px 9px",
              borderRadius: 999,
            }}
          >
            Computable · never downloadable
          </span>
        </div>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px,4vw,40px)",
            margin: "16px 0 10px",
            color: "var(--ov-text)",
          }}
        >
          {artifact.title}
        </h1>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TxLink ipId={artifact.ipId} />
          <TxLink hash={artifact.createdTx} />
          {artifact.computeLicenseTermsId ? (
            <span
              className="font-mono"
              style={{ fontSize: 11.5, color: "var(--ov-text-faint)" }}
            >
              compute terms #{artifact.computeLicenseTermsId}
            </span>
          ) : null}
        </div>
      </div>

      <hr className="divider-ink" style={{ margin: "24px 0" }} />

      <div className="ov-compute-grid">
        <AlgoAllowlist artifact={artifact} />
        <ComputeJobPanel artifact={artifact} />
      </div>
    </div>
  );
}

function Notice({
  title,
  body,
  backHref = "/",
  backLabel = "Back to browse",
}: {
  title: string;
  body: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div
      className="container maxw-artifact"
      style={{ paddingTop: 60, paddingBottom: 60 }}
    >
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
        <span className="eyebrow" style={{ color: "var(--tier-compute)" }}>
          Compute
        </span>
        <div
          className="font-display"
          style={{
            fontSize: 22,
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--ov-text)",
          }}
        >
          {title}
        </div>
        <p
          style={{
            margin: 0,
            color: "var(--ov-text-dim)",
            fontSize: 13,
            maxWidth: 420,
          }}
        >
          {body}
        </p>
        <Link href={backHref} className="btn btn-accent" style={{ marginTop: 6 }}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
