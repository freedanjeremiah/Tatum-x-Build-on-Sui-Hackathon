// Dataset Viewer tab. Loads the index record server-side and hands tier + cid
// to the client preview, which fetches a bounded inline preview for public
// artifacts and shows a locked state for encrypted tiers.

export const runtime = "nodejs";

import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import DatasetPreview from "@/components/DatasetPreview";

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;
  if (!artifact) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="meta" style={{ color: "var(--ov-text-faint)" }}>
        Inline preview
      </div>
      <DatasetPreview tier={artifact.tier} cid={artifact.cid} />
    </div>
  );
}
