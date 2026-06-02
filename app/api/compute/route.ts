// Worker runs OUTSIDE CDR. CDR is gated key-delivery only. Compute privacy =
// this worker's isolation + the per-dataset algorithm allowlist.
//
// This route ENQUEUES/RUNS a compute job. It loads the dataset's PUBLIC index
// record to read its allowedAlgoHashes, then delegates to the real
// confidential-compute worker (worker/compute-worker.ts).
//
// INVARIANTS enforced here:
//   - off-allowlist algoHash → rejected, decryptCalled:false, NO decryption.
//   - a "done" run returns ONLY aggregate metrics (never raw rows) and registers
//     the result as a derivative of the dataset (royalties flow upstream).

export const runtime = "nodejs"; // Edge unsupported for sqlite/CDR

import { openDb, getArtifact } from "@/indexer/db";
import { runComputeJob } from "@/worker/compute-worker";
import type { DB } from "@/indexer/db";
import type { Artifact, ComputeJobResult } from "@/types/artifact";

let _db: DB | null = null;

function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

function json(data: ComputeJobResult, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: { datasetIpId?: string; algoHash?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ status: "failed", reason: "invalid JSON body" }, 400);
  }

  const { datasetIpId, algoHash, params } = body;
  if (!datasetIpId || !algoHash) {
    return json(
      { status: "failed", reason: "datasetIpId and algoHash are required" },
      400
    );
  }

  // STEP 1: load the dataset's PUBLIC index record to read its allowlist.
  const dataset = getArtifact(db(), datasetIpId) as Artifact | undefined;
  if (!dataset) {
    return json({ status: "failed", reason: "dataset not found in index" }, 404);
  }
  if (dataset.tier !== "compute" || !dataset.computeEnabled) {
    return json(
      { status: "failed", reason: "dataset is not a compute artifact" },
      400
    );
  }

  const allowed = dataset.allowedAlgoHashes ?? [];

  // STEP 2: delegate to the real confidential-compute worker
  // (worker/compute-worker.ts). The worker re-checks the allowlist BEFORE any
  // decryption, decrypts the dataset INSIDE the worker, runs the allowlisted
  // algo, registers the result as a derivative, wipes the plaintext, and
  // returns metrics only (never raw rows).
  // (worker/compute-worker is server/node-only; imported here on the server.)
  const result = await runComputeJob({
    datasetIpId: datasetIpId as `0x${string}`,
    algoHash,
    params,
    allowedAlgoHashes: allowed,
    dataset,
  });

  // Self-index the result derivative so the read model (browse, leaderboard,
  // parent's "claimable derivatives" count) reflects the run immediately.
  // If the local index write fails, the on-chain derivative is still real —
  // we surface the failure as a non-fatal warning instead of swallowing it.
  if (result.status === "done" && result.resultIpId && result.resultTx) {
    try {
      const { upsertArtifact } = await import("@/indexer/db");
      upsertArtifact(db(), {
        ipId: result.resultIpId,
        tier: "public",
        modality: "dataset",
        title: `Compute result · ${algoHash}`,
        description:
          "Aggregate compute result derived in the confidential-compute worker. Metrics only.",
        tags: ["compute-result", "derivative"],
        ipMetadataURI: "",
        parentIpId: datasetIpId as `0x${string}`,
        createdTx: result.resultTx,
      });
      const { getArtifact } = await import("@/indexer/db");
      const parent = getArtifact(db(), datasetIpId);
      if (parent) {
        parent.score = (parent.score ?? 0) + 3;
        upsertArtifact(db(), parent);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      const note = `server-side index update failed: ${msg}. On-chain derivative is real; only the local read model is stale.`;
      result.warning = result.warning ? `${result.warning}; ${note}` : note;
      console.warn("[api/compute] self-index failed:", e);
    }
  }

  return json(result, result.status === "failed" ? 500 : 200);
}
