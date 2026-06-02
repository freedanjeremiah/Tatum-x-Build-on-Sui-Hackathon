// "Run" tab — live inference for MODEL artifacts. Datasets are not runnable, so
// for non-model modalities we say so plainly rather than showing a dead box.

export const runtime = "nodejs";

import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import RunInference from "@/components/RunInference";

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;

  if (!artifact || artifact.modality !== "model") {
    return (
      <p style={{ color: "var(--ov-text-dim)", fontSize: 14 }}>
        Only <strong>model</strong> artifacts are runnable. This is a{" "}
        {artifact?.modality ?? "missing"} artifact.
      </p>
    );
  }

  return <RunInference ipId={ipId} />;
}
