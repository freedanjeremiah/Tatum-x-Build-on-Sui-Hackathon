// The worker is the privacy boundary, not Seal — Seal only delivers keys when the
// on-chain policy allows. Compute privacy = this worker's isolation + the
// per-dataset algorithm allowlist.
//
// This route ENQUEUES/RUNS a compute job. It loads the dataset's PUBLIC index
// record to read its allowedAlgoHashes, then delegates to the real
// confidential-compute worker (worker/compute-worker.ts).
//
// INVARIANTS enforced here:
//   - off-allowlist algoHash → rejected, decryptCalled:false, NO decryption.
//   - a "done" run returns ONLY aggregate metrics (never raw rows) and registers
//     the result as a derivative of the dataset (royalties flow upstream).
//   - enclave-nautilus mode: FAIL CLOSED — if env vars are missing the route
//     returns 500 and refuses to fall back to a plain server execution.

export const runtime = "nodejs"; // Edge unsupported for sqlite + native crypto

import { openDb, getArtifact } from "@/indexer/db";
import { runComputeJob } from "@/worker/compute-worker";
import { workerIsolation } from "@/lib/attestation";
import { callEnclave } from "@/lib/enclaveClient";
import { makeClientsFromKey } from "@/lib/clients";
import { RegistryClient } from "@/lib/registry";
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

  // STEP 2: Branch on the worker isolation mode.
  //
  // enclave-nautilus: attested compute path — calls the Nautilus enclave,
  // verifies the enclave signature on-chain via reef::registry, and returns the
  // attestation tx. FAIL CLOSED — any missing env var aborts with 500 rather than
  // silently degrading to a plain-server run.
  //
  // all other modes: legacy path — delegate to compute-worker.ts as before.

  const isolationMode = workerIsolation();

  if (isolationMode === "enclave-nautilus") {
    // 1. Require both ENCLAVE_PROCESS_URL and REEF_ENCLAVE_OBJECT_ID — fail closed.
    const enclaveUrl = process.env.ENCLAVE_PROCESS_URL;
    const enclaveObjectId = process.env.REEF_ENCLAVE_OBJECT_ID;
    if (!enclaveUrl || !enclaveObjectId) {
      return json(
        {
          status: "failed",
          reason:
            "enclave-nautilus mode set but ENCLAVE_PROCESS_URL / REEF_ENCLAVE_OBJECT_ID missing" +
            " — refusing to fall back to plain server",
          decryptCalled: false,
        },
        500,
      );
    }

    // 2. Allowlist gate — check BEFORE any decryption.
    if (!allowed.includes(algoHash)) {
      return json(
        {
          status: "rejected",
          reason: "algorithm not on dataset allowlist",
          decryptCalled: false,
        },
        200,
      );
    }

    // 3. Call the Nautilus enclave.
    let signed: Awaited<ReturnType<typeof callEnclave>>;
    try {
      signed = await callEnclave({ datasetIpId, algoHash, params });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return json({ status: "failed", reason: message, decryptCalled: true }, 500);
    }

    // 4. Require WALLET_PRIVATE_KEY for on-chain registration.
    const pk = process.env.WALLET_PRIVATE_KEY;
    if (!pk) {
      return json(
        { status: "failed", reason: "WALLET_PRIVATE_KEY not set" },
        500,
      );
    }

    // 5. Build Sui clients.
    const clients = await makeClientsFromKey(pk);
    const rc = new RegistryClient(clients.client);

    // 6. Encode metrics as bytes.
    const metricsBytes = new TextEncoder().encode(JSON.stringify({ metrics: signed.metrics }));

    // 7. Call registerDerivativeAttested — verifies enclave sig on-chain.
    let digest: string;
    try {
      digest = await rc.registerDerivativeAttested(
        {
          tier: "public",
          parentId: datasetIpId,
          enclaveObjectId,
          timestampMs: signed.timestampMs,
          algoHash,
          metrics: metricsBytes,
          signature: signed.signature,
        },
        clients.signer as never,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return json(
        {
          status: "failed",
          reason: "on-chain attestation verify failed: " + message,
          decryptCalled: true,
        },
        500,
      );
    }

    // 8. Success — return metrics + attestation info.
    return json(
      {
        status: "done",
        metrics: signed.metrics,
        resultTx: digest as `0x${string}`,
        decryptCalled: true,
        isolationMode:
          "compute worker in AWS Nitro enclave — attestation verified on-chain (tx " + digest + ")",
        attestation: {
          validatorAttestationEnabled: false,
          enforced: false,
          untrustedValidators: 0,
          workerIsolation: "enclave-nautilus" as const,
          enclaveObjectId: enclaveObjectId as `0x${string}`,
          attestationTx: digest as `0x${string}`,
        },
      },
      200,
    );
  } else {
    // Legacy path — delegate to the real confidential-compute worker.
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
}
