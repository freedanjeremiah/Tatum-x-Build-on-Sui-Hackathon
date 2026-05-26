// Compute page. Loads the dataset's PUBLIC index record (index-only — no keys,
// no plaintext) and renders the allowlist + run panel. There is NO download path
// anywhere on this page: a compute artifact is computable, never downloadable.

export const runtime = "nodejs";

import Link from "next/link";
import { openDb, getArtifact, listArtifacts, upsertArtifact } from "@/indexer/db";
import { SEED_ARTIFACTS } from "@/lib/mock/seed";
import { IS_MOCK } from "@/lib/env";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import { TierBadge } from "@/components/ModelCard";
import TxLink from "@/components/TxLink";
import AlgoAllowlist from "@/components/AlgoAllowlist";
import ComputeJobPanel from "@/components/ComputeJobPanel";

let _db: DB | null = null;

function db(): DB {
  if (_db) return _db;
  const d = openDb();
  if (IS_MOCK && listArtifacts(d, {}).length === 0) {
    for (const a of SEED_ARTIFACTS) upsertArtifact(d, a);
  }
  _db = d;
  return d;
}

export default async function ComputePage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;

  if (!artifact) {
    return <Notice title="No artifact with that ID" body={`The IP asset ${ipId} is not in the index.`} />;
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
    <div className="mx-auto max-w-4xl px-5 pb-24">
      {/* breadcrumb */}
      <div className="ov-anim-up flex items-center gap-2 pt-6 text-[12px] text-[var(--ov-text-faint)]">
        <Link href="/" className="transition-colors hover:text-[var(--ov-text)]">
          Browse
        </Link>
        <span>/</span>
        <Link
          href={`/artifact/${artifact.ipId}`}
          className="transition-colors hover:text-[var(--ov-text)]"
        >
          {artifact.modality}
        </Link>
        <span>/</span>
        <span className="text-[var(--ov-text-dim)]">compute</span>
      </div>

      {/* header */}
      <header className="ov-anim-up mt-4 flex flex-col gap-4 border-b border-[var(--ov-line)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={artifact.tier} />
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ov-line-soft)] px-2 py-0.5 text-[10px] capitalize text-[var(--ov-text-faint)]">
            {artifact.modality}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-compute)]/40 bg-[var(--tier-compute)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--tier-compute)]">
            Computable · never downloadable
          </span>
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--ov-text)]">
          {artifact.title}
        </h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--ov-text-dim)]">
          {artifact.description}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <TxLink ipId={artifact.ipId} />
          <TxLink hash={artifact.createdTx} />
          {artifact.computeLicenseTermsId && (
            <span className="font-mono text-[11px] text-[var(--ov-text-faint)]">
              compute terms #{artifact.computeLicenseTermsId}
            </span>
          )}
        </div>
      </header>

      <div className="ov-anim-up mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
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
    <div className="mx-auto flex min-h-[55vh] max-w-[1400px] flex-col items-center justify-center gap-4 px-5 text-center">
      <span className="rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--tier-compute)]">
        Compute
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ov-text)]">
        {title}
      </h1>
      <p className="max-w-md text-[13px] text-[var(--ov-text-dim)]">{body}</p>
      <Link
        href={backHref}
        className="rounded-lg border border-[var(--ov-line)] px-4 py-2 text-[13px] text-[var(--ov-text-dim)] transition-colors hover:text-[var(--ov-text)]"
      >
        {backLabel}
      </Link>
    </div>
  );
}
