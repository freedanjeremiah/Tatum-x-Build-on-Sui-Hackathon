// Confidential-compute worker (SPEC §C6). SERVER/NODE ONLY — never import this
// from a client bundle. The /api/compute route imports it server-side.
//
// HONESTY INVARIANT (must never be violated):
//   CDR does threshold encryption + on-chain-gated KEY DELIVERY only. It does
//   NOT run user algorithms on plaintext. "Private but computable" = THIS worker
//   decrypts the dataset (via CDR's gated download) INSIDE the worker, runs an
//   ALLOWLISTED, hash-pinned algorithm over the plaintext, returns ONLY the
//   result/metrics, then WIPES the plaintext. The privacy guarantee comes from
//   the worker's isolation + the per-dataset algorithm allowlist — NOT from CDR.
//
//   This demo worker runs on a PLAIN server (operator-trusted). The operator can
//   in principle read plaintext in memory. We disclose this honestly in every
//   result via `isolationMode`. A production deployment would attest a hardware
//   enclave (SGX/TDX); the contract here is unchanged.

import { allowlistCheck } from "../lib/compute";
import { registerDerivative, type Clients } from "../lib/artifacts";
import { heliaProvider } from "../lib/storage";
import { getAlgo } from "./algoRegistry";
import type { ComputeJobResult, Artifact } from "../types/artifact";

const ISOLATION_MODE = "plain-server (operator-trusted, demo)";

/** Input for one confidential-compute run. */
export interface WorkerInput {
  datasetIpId: `0x${string}`;
  algoHash: string;
  params?: Record<string, unknown>;
  /** Dataset allowlist. If omitted, resolved from the dataset artifact/index. */
  allowedAlgoHashes?: string[];
  /** The dataset artifact (so the worker can find vaultUuid/licenseTermsId). */
  dataset?: Artifact;
  /** {cdr, story, account} bundle. Resolved from WALLET_PRIVATE_KEY if omitted. */
  clients?: Clients;
}

/**
 * Decrypt the dataset INSIDE the worker via CDR's gated download, then parse the
 * plaintext into numeric rows. Returns the rows AND the raw plaintext buffer so
 * the caller can wipe both.
 *
 * REAL-ONLY: there is NO synthetic fallback. The worker mints a real COMPUTE
 * license token for the dataset IP, encodes it as accessAuxData, and presents it
 * to the CDR consumer's gated download to collect the threshold key and decrypt
 * the real vault entry. If the dataset has no CDR vault, no compute license terms,
 * or CDR returns nothing, this THROWS — the caller turns that into status:"failed".
 */
async function decryptDataset(
  clients: Clients,
  dataset: Artifact | undefined,
  datasetIpId: `0x${string}`
): Promise<{ rows: number[][]; plaintext: Uint8Array; licenseTokenId: bigint }> {
  const uuid = dataset?.vaultUuid;
  if (uuid === undefined || dataset === undefined) {
    throw new Error("compute: dataset has no CDR vault (vaultUuid) — cannot decrypt");
  }
  if (!clients.cdr?.consumer?.downloadFile) {
    throw new Error("compute: CDR consumer unavailable");
  }

  // Mint the real compute license token and encode it as accessAuxData.
  const { mintLicense, encodeAccessAuxData } = await import("../lib/licensing");
  const termsId = dataset.computeLicenseTermsId ?? dataset.licenseTermsId;
  if (!termsId) throw new Error("compute: dataset has no compute license terms id");
  const licenseTokenId = await mintLicense(clients.story, datasetIpId, termsId);
  const accessAuxData = encodeAccessAuxData([licenseTokenId]);

  const storageProvider = await heliaProvider();
  const out = await clients.cdr.consumer.downloadFile({
    uuid,
    accessAuxData,
    storageProvider,
    timeoutMs: 120000,
  });
  const plaintext = out?.content as Uint8Array;
  if (!plaintext) throw new Error("compute: CDR returned no content");

  let rows: number[][];
  try {
    rows = parseRows(plaintext);
  } catch (e) {
    plaintext.fill(0); // wipe before propagating — never leave decrypted bytes in memory
    throw e;
  }
  return { rows, plaintext, licenseTokenId };
}

/** Parse decrypted plaintext into a numeric matrix. Accepts a few shapes. */
function parseRows(bytes: Uint8Array): number[][] {
  const text = new TextDecoder().decode(bytes);
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) {
    // [[...],[...]] matrix, or a flat [n,n,...] vector → single column.
    if (data.length > 0 && Array.isArray(data[0])) return data as number[][];
    return (data as number[]).map((v) => [v]);
  }
  if (data && typeof data === "object" && "values" in data) {
    const vals = (data as { values: number[] }).values;
    return vals.map((v) => [v]);
  }
  throw new Error("worker: unrecognized dataset shape");
}

/** Zero a Uint8Array / number[][] in place (best-effort plaintext wipe). */
function wipe(plaintext: Uint8Array | null, rows: number[][] | null): void {
  if (plaintext) plaintext.fill(0);
  if (rows) {
    for (const row of rows) row.fill(0);
    rows.length = 0;
  }
}

/**
 * Run one confidential-compute job. Implements the §C6 worker steps:
 *   1. resolve allowlist; 2. allowlist GATE (reject before any decrypt);
 *   3. CDR-decrypt INSIDE the worker; 4. run the allowlisted algo;
 *   5. register the result as a DERIVATIVE of the dataset; 6. WIPE plaintext;
 *   7. return metrics ONLY (never raw rows) + an honest isolation disclosure.
 */
export async function runComputeJob(
  input: WorkerInput
): Promise<ComputeJobResult> {
  const allowed = input.allowedAlgoHashes ?? input.dataset?.allowedAlgoHashes ?? [];

  // STEP 2: allowlist GATE — BEFORE any decryption. Also requires the algo to be
  // registered here (blocked/reconstructing algos are absent → undefined).
  const algo = getAlgo(input.algoHash);
  if (!allowlistCheck(input.algoHash, allowed) || !algo) {
    return {
      status: "rejected",
      reason: "algorithm not on dataset allowlist (or not registered)",
      decryptCalled: false,
      isolationMode: ISOLATION_MODE,
    };
  }

  // Resolve a real client bundle if the caller didn't pass one. No dummy key:
  // a missing WALLET_PRIVATE_KEY is a loud configuration error, not a silent
  // fallback — the outer try/catch returns status:"failed" with this message.
  let clients = input.clients;
  if (!clients) {
    const { makeClientsFromKey } = await import("../lib/clients");
    const pk = process.env.WALLET_PRIVATE_KEY;
    if (!pk) throw new Error("compute worker: WALLET_PRIVATE_KEY is not set — cannot run a real compute job");
    clients = (await makeClientsFromKey(pk as `0x${string}`)) as unknown as Clients;
  }

  // STEP 3: CDR-decrypt the dataset INSIDE the worker.
  let plaintext: Uint8Array | null = null;
  let rows: number[][] | null = null;
  let scratchCleared = false;
  let licenseTokenId: bigint | undefined;
  try {
    const dec = await decryptDataset(clients, input.dataset, input.datasetIpId);
    plaintext = dec.plaintext;
    rows = dec.rows;
    licenseTokenId = dec.licenseTokenId;

    // STEP 4: run the ALLOWLISTED algorithm over the plaintext rows.
    const algoOut = algo.run(rows, input.params) as Record<string, unknown>;

    // Flatten to a numeric metrics map (ComputeJobResult.metrics). Arrays are
    // expanded as col0,col1,... — still aggregates, never raw rows.
    const metrics = toMetrics(algoOut);

    // STEP 5: register the RESULT as a DERIVATIVE of the dataset so royalties
    // flow upstream to the dataset IP. Only metrics are persisted, never rows.
    // Fail loudly if there is no resolvable parent terms id — registering under
    // wrong terms would route royalties incorrectly.
    const parentTermsId =
      input.dataset?.computeLicenseTermsId ?? input.dataset?.licenseTermsId;
    let resultIpId: `0x${string}` | undefined;
    let resultTx: `0x${string}` | undefined;
    let warning: string | undefined;
    if (!parentTermsId) {
      warning =
        "derivative not registered: dataset has no resolvable license terms id";
    } else {
      try {
        const child = await registerDerivative(clients, {
          parentIpId: input.datasetIpId,
          parentTermsId,
          bytes: new TextEncoder().encode(JSON.stringify({ metrics })),
          meta: {
            title: `Compute result (${algo.name})`,
            description:
              "Aggregate compute result derived in the confidential-compute worker. Metrics only — the source dataset's raw rows never left the worker.",
            tags: ["compute-result", algo.name, "derivative"],
            creators: [
              {
                name: "OpenVault Compute Worker",
                address: clients.account.address,
                contributionPercent: 100,
              },
            ],
            modality: "dataset",
          },
        });
        resultIpId = child.ipId;
        resultTx = child.createdTx;
      } catch (e) {
        // Don't fail the whole job — metrics are still safe to return — but
        // surface the failure clearly so the caller can investigate.
        warning = `derivative registration failed: ${(e as Error).message}`;
      }
    }

    // STEP 6: WIPE plaintext + scratch (zero buffers, drop references).
    wipe(plaintext, rows);
    scratchCleared = isCleared(plaintext, rows);
    plaintext = null;
    rows = null;

    // STEP 7: return metrics ONLY + honest isolation disclosure. No raw rows.
    return {
      status: "done",
      metrics,
      resultIpId,
      resultTx,
      isolationMode: ISOLATION_MODE,
      decryptCalled: true,
      scratchCleared,
      licenseTokenId: licenseTokenId !== undefined ? licenseTokenId.toString() : undefined,
      warning,
    };
  } catch (e) {
    // On any failure, still wipe whatever plaintext we hold — then verify it.
    wipe(plaintext, rows);
    const cleared = isCleared(plaintext, rows);
    plaintext = null;
    rows = null;
    return {
      status: "failed",
      reason: (e as Error).message,
      isolationMode: ISOLATION_MODE,
      decryptCalled: true,
      scratchCleared: cleared,
    };
  }
}

/** Assert the scratch buffers are zeroed (testable wipe invariant). */
function isCleared(plaintext: Uint8Array | null, rows: number[][] | null): boolean {
  const ptOk = !plaintext || plaintext.every((b) => b === 0);
  const rowsOk = !rows || rows.length === 0;
  return ptOk && rowsOk;
}

/** Flatten an algo's aggregate output into a numeric metrics map. */
function toMetrics(out: Record<string, unknown>): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "number") metrics[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
      (v as number[]).forEach((x, i) => (metrics[`${k}_${i}`] = x));
    }
    // Objects / strings are dropped — metrics are numeric aggregates only.
  }
  return metrics;
}
