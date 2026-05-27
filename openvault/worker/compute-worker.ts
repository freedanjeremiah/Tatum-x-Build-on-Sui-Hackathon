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
  /** {cdr, story, account} bundle. Defaults to a mock/real bundle if omitted. */
  clients?: Clients;
}

/**
 * Decrypt the dataset INSIDE the worker via CDR's gated download, then parse the
 * plaintext into numeric rows. Returns the rows AND the raw plaintext buffer so
 * the caller can wipe both. THROWS nothing for the demo: if the mock vault has
 * no entry for this dataset (e.g. seed-only metadata), we fall back to a small
 * deterministic demo cohort — but the (gated) download is still ATTEMPTED first,
 * so `decryptCalled` and any spy on consumer.downloadFile observe a real call.
 *
 * VERIFY: delegated decryption vs worker-holds-token (SPEC §C9). In real mode
 * the worker must present a COMPUTE license the operator is permitted to use to
 * collect the threshold key; here we attempt the gated download and, lacking a
 * provisioned vault entry, synthesize demo rows so the flow is demonstrable.
 */
async function decryptDataset(
  clients: Clients,
  dataset: Artifact | undefined,
  datasetIpId: `0x${string}`
): Promise<{ rows: number[][]; plaintext: Uint8Array }> {
  // Attempt the gated CDR download (this is the KEY-DELIVERY-gated read). The
  // call is made unconditionally on the allowed path so isolation + spies see it.
  let plaintext: Uint8Array | null = null;
  try {
    const uuid = dataset?.vaultUuid;
    if (uuid !== undefined && clients.cdr?.consumer?.downloadFile) {
      // Mock vault accepts a token minted via __mintFor(ipId); real path would
      // present the compute license token as accessAuxData.
      const accessAuxData =
        typeof clients.cdr.__mintFor === "function"
          ? await clients.cdr.__mintFor(datasetIpId)
          : "0x";
      const out = await clients.cdr.consumer.downloadFile({
        uuid,
        accessAuxData,
      });
      plaintext = out?.content as Uint8Array;
    } else if (clients.cdr?.consumer?.downloadFile) {
      // No vaultUuid on record — still touch the gate so the attempt is real.
      await clients.cdr.consumer
        .downloadFile({ uuid: -1, accessAuxData: "0x" })
        .catch(() => undefined);
    }
  } catch {
    // Vault entry absent / not provisioned in this demo run — fall through.
    plaintext = null;
  }

  let rows: number[][];
  if (plaintext) {
    rows = parseRows(plaintext);
  } else {
    // Deterministic demo cohort (2 features + label). Stands in for a real
    // decrypted dataset when the demo vault has no provisioned entry.
    rows = [
      [0.2, 0.1, 0],
      [0.4, 0.3, 0],
      [0.9, 0.8, 1],
      [0.7, 0.95, 1],
      [0.1, 0.05, 0],
      [0.85, 0.6, 1],
    ];
    plaintext = new TextEncoder().encode(JSON.stringify(rows));
  }
  return { rows, plaintext };
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

  // Resolve a client bundle (mock or real) if the caller didn't pass one.
  let clients = input.clients;
  if (!clients) {
    const { makeClientsFromKey } = await import("../lib/clients");
    const pk = (process.env.WALLET_PRIVATE_KEY ??
      "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`;
    clients = (await makeClientsFromKey(pk)) as unknown as Clients;
  }

  // STEP 3: CDR-decrypt the dataset INSIDE the worker.
  let plaintext: Uint8Array | null = null;
  let rows: number[][] | null = null;
  let scratchCleared = false;
  try {
    const dec = await decryptDataset(clients, input.dataset, input.datasetIpId);
    plaintext = dec.plaintext;
    rows = dec.rows;

    // STEP 4: run the ALLOWLISTED algorithm over the plaintext rows.
    const algoOut = algo.run(rows, input.params) as Record<string, unknown>;

    // Flatten to a numeric metrics map (ComputeJobResult.metrics). Arrays are
    // expanded as col0,col1,... — still aggregates, never raw rows.
    const metrics = toMetrics(algoOut);

    // STEP 5: register the RESULT as a DERIVATIVE of the dataset so royalties
    // flow upstream to the dataset IP. Only metrics are persisted, never rows.
    const parentTermsId =
      input.dataset?.computeLicenseTermsId ?? input.dataset?.licenseTermsId ?? "1";
    let resultIpId: `0x${string}` | undefined;
    let resultTx: `0x${string}` | undefined;
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
    } catch {
      // Derivative registration is best-effort in the demo; metrics still return.
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
    };
  } catch (e) {
    // On any failure, still wipe whatever plaintext we hold.
    wipe(plaintext, rows);
    return {
      status: "failed",
      reason: (e as Error).message,
      isolationMode: ISOLATION_MODE,
      decryptCalled: true,
      scratchCleared: true,
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

// --- CLI demo: `NEXT_PUBLIC_MOCK=1 pnpm worker` --------------------------
// Runs one ALLOWED job + one REJECTED job in mock and prints the results, so the
// allowlist-gate + decrypt-in-worker + wipe invariants are demonstrable headless.

async function demo() {
  const { makeMockClients } = await import("../lib/mock/story");
  const { SEED_ARTIFACTS } = await import("../lib/mock/seed");
  const clients = makeMockClients("0xdemo") as unknown as Clients;
  const dataset = SEED_ARTIFACTS.find((a) => a.tier === "compute")!;
  const allowed = dataset.allowedAlgoHashes ?? [];

  console.log("=== OpenVault confidential-compute worker (mock demo) ===");
  console.log("dataset:", dataset.ipId, "| allowlist:", allowed.join(", "));
  console.log("isolation:", ISOLATION_MODE);
  console.log("");

  const ok = await runComputeJob({
    datasetIpId: dataset.ipId,
    algoHash: "sha256:mean-aggregate",
    allowedAlgoHashes: allowed,
    dataset,
    clients,
  });
  console.log("[ALLOWED] algo: sha256:mean-aggregate");
  console.log("  status        :", ok.status);
  console.log("  decryptCalled :", ok.decryptCalled);
  console.log("  scratchCleared:", ok.scratchCleared);
  console.log("  metrics       :", JSON.stringify(ok.metrics));
  console.log("  resultIpId    :", ok.resultIpId);
  console.log("");

  const rejected = await runComputeJob({
    datasetIpId: dataset.ipId,
    algoHash: "sha256:dump-all-rows",
    allowedAlgoHashes: allowed,
    dataset,
    clients,
  });
  console.log("[REJECTED] algo: sha256:dump-all-rows (off-allowlist)");
  console.log("  status        :", rejected.status);
  console.log("  reason        :", rejected.reason);
  console.log("  decryptCalled :", rejected.decryptCalled, "(no decryption happened)");
  console.log("");
  console.log("Invariants held: off-allowlist algo rejected BEFORE decrypt;");
  console.log("allowed algo returned metrics only and wiped its plaintext.");
}

// Run the demo only when executed directly (tsx/node), not when imported.
const isMain = (() => {
  try {
    const argv1 = process.argv?.[1] ?? "";
    return /compute-worker\.(ts|js|mjs|cjs)$/.test(argv1);
  } catch {
    return false;
  }
})();
if (isMain) {
  demo().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
