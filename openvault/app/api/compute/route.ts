// Worker runs OUTSIDE CDR. CDR is gated key-delivery only. Compute privacy =
// this worker's isolation + the per-dataset algorithm allowlist.
//
// This route ENQUEUES/RUNS a compute job. It loads the dataset's PUBLIC index
// record to read its allowedAlgoHashes, then delegates to the worker contract
// runComputeJob (lib/compute). Today that is an inline mock; Phase 5 replaces it
// with worker/compute-worker.ts implementing the SAME RunComputeJob signature.
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

  // STEP 2: delegate to the REAL confidential-compute worker (Phase 5). The
  // worker re-checks the allowlist BEFORE any decryption, decrypts the dataset
  // INSIDE the worker, runs the allowlisted algo, registers the result as a
  // derivative, wipes the plaintext, and returns metrics only (never raw rows).
  // (worker/compute-worker is server/node-only; imported here on the server.)
  const result = await runComputeJob({
    datasetIpId: datasetIpId as `0x${string}`,
    algoHash,
    params,
    allowedAlgoHashes: allowed,
    dataset,
  });

  return json(result, result.status === "failed" ? 500 : 200);
}
