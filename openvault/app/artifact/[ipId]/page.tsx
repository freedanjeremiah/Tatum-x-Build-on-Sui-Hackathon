// Artifact detail. Loads the PUBLIC index record server-side (index-only — no
// keys, no plaintext) and renders the interactive detail client component.

export const runtime = "nodejs";

import Link from "next/link";
import { openDb, getArtifact, listArtifacts, upsertArtifact } from "@/indexer/db";
import { SEED_ARTIFACTS } from "@/lib/mock/seed";
import { IS_MOCK } from "@/lib/env";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import ArtifactDetail from "@/components/ArtifactDetail";

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

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;

  if (!artifact) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-[1400px] flex-col items-center justify-center gap-4 px-5 text-center">
        <span className="rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--tier-gated)]">
          Not found
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ov-text)]">
          No artifact with that ID
        </h1>
        <p className="max-w-md text-[13px] text-[var(--ov-text-dim)]">
          The IP asset{" "}
          <code className="font-mono text-[var(--ov-text-faint)]">{ipId}</code>{" "}
          is not in the index.
        </p>
        <Link
          href="/"
          className="rounded-lg border border-[var(--ov-line)] px-4 py-2 text-[13px] text-[var(--ov-text-dim)] transition-colors hover:text-[var(--ov-text)]"
        >
          Back to browse
        </Link>
      </div>
    );
  }

  return <ArtifactDetail artifact={artifact} />;
}
