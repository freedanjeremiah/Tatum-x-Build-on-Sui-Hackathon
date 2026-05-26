// Compute helpers: allowlist gating, ComputeJob construction, the runComputeJob
// worker contract (with an inline mock impl), and a browser-facing runJob that
// POSTs to /api/compute.
//
// HONESTY: CDR does key-delivery ONLY. Compute privacy = worker isolation +
// the per-dataset algorithm allowlist, NOT CDR. A compute result returns ONLY
// metrics — never raw rows. The worker refuses any algoHash not on the dataset's
// allowlist BEFORE any decryption (rejected, decryptCalled: false).

import type { ComputeJob, ComputeJobResult } from "../types/artifact";

/** UUID that works in both Node and the browser (no node:crypto import). */
function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

/** True iff `algoHash` is in the allowlist. Checked BEFORE any decryption. */
export function allowlistCheck(algoHash: string, allowed: string[]): boolean {
  return allowed.includes(algoHash);
}

export interface SubmitJobArgs {
  datasetIpId: `0x${string}`;
  consumer: `0x${string}`;
  algoHash: string;
  computeLicenseTokenId: bigint;
}

/** Build a new ComputeJob in the "pending" state. */
export function submitJob(args: SubmitJobArgs): ComputeJob {
  return {
    id: uuid(),
    datasetIpId: args.datasetIpId,
    consumer: args.consumer,
    algoHash: args.algoHash,
    computeLicenseTokenId: args.computeLicenseTokenId,
    status: "pending",
  };
}

/** The result a compute run returns — metrics only, never raw rows. */
export interface ComputeResult {
  status: ComputeJob["status"];
  metrics?: Record<string, number>;
  resultIpId?: `0x${string}`;
  [k: string]: unknown;
}

/** A runner takes a job and returns its result (raw rows are never returned). */
export type ComputeRunner = (job: ComputeJob) => Promise<ComputeResult>;

// --- runComputeJob worker contract -------------------------------------

/** Input for a single compute run. */
export interface RunComputeJobInput {
  datasetIpId: `0x${string}`;
  algoHash: string;
  params?: Record<string, unknown>;
}

/**
 * The worker contract. Phase 5 swaps the inline mock impl below for
 * `worker/compute-worker.ts` implementing this exact signature. The /api/compute
 * route calls it; nothing about its contract changes when the worker lands.
 *
 * Worker runs OUTSIDE CDR. CDR is gated key-delivery only. Compute privacy =
 * this worker's isolation + the per-dataset algorithm allowlist.
 */
export type RunComputeJob = (
  input: RunComputeJobInput
) => Promise<ComputeJobResult>;

const ISOLATION_MODE = "plain-server (operator-trusted, demo)";

/** Human-friendly names for the seed's hash-pinned algorithms. */
export const ALGO_NAMES: Record<string, string> = {
  "sha256:mean-aggregate": "Mean aggregate (DP-friendly)",
  "sha256:logistic-regression": "Logistic regression (coefficients only)",
};

export function algoName(hash: string): string {
  return ALGO_NAMES[hash] ?? hash.replace(/^sha256:/, "");
}

/**
 * Inline mock implementation of the worker contract.
 *
 * 1. allowlistCheck(algoHash, allowed) — if NOT allowed: return rejected with
 *    decryptCalled:false and NO decryption performed.
 * 2. if allowed: simulate verify-token → decrypt-in-worker (mock) → run a
 *    trivial aggregate over fake numeric rows → produce metrics (NO raw rows) →
 *    register the result as a derivative of datasetIpId (mock) → return done.
 */
export async function runComputeJobInline(
  input: RunComputeJobInput,
  allowed: string[]
): Promise<ComputeJobResult> {
  // STEP 1: allowlist gate — BEFORE any decryption.
  if (!allowlistCheck(input.algoHash, allowed)) {
    return {
      status: "rejected",
      reason: "algorithm not on dataset allowlist",
      decryptCalled: false,
    };
  }

  // STEP 2: verify license token (mock) → decrypt-in-worker (mock). In a real
  // deployment this is where CDR delivers the key INTO the isolated worker; the
  // plaintext never leaves the worker boundary.
  const decryptCalled = true;

  // STEP 3: run a trivial aggregate over fake numeric rows (never returned).
  const fakeRows = [12, 18, 23, 31, 7, 19, 27, 14, 22, 9];
  const n = fakeRows.length;
  const sum = fakeRows.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  let metrics: Record<string, number>;
  if (input.algoHash === "sha256:logistic-regression") {
    // Coefficients only — no rows, no per-record output.
    metrics = {
      n,
      intercept: Number((mean / 10).toFixed(4)),
      coefficient: Number((1 / (1 + Math.exp(-mean / 10))).toFixed(4)),
      accuracy: 0.84,
    };
  } else {
    // mean-aggregate (default)
    const variance = fakeRows.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    metrics = {
      n,
      mean: Number(mean.toFixed(4)),
      stddev: Number(Math.sqrt(variance).toFixed(4)),
      min: Math.min(...fakeRows),
      max: Math.max(...fakeRows),
    };
  }

  // STEP 4: register the result as a derivative of the dataset (mock) so
  // royalties flow upstream to datasetIpId.
  const resultIpId = ("0xresult" +
    input.datasetIpId.slice(2, 36)).slice(0, 42) as `0x${string}`;
  const resultTx = ("0xresulttx" +
    uuid().replace(/-/g, "")).slice(0, 66) as `0x${string}`;

  return {
    status: "done",
    metrics,
    resultIpId,
    resultTx,
    metricsURI: `ipfs://bafyMetrics${input.algoHash.replace(/[^a-z0-9]/gi, "")}`,
    isolationMode: ISOLATION_MODE,
    decryptCalled,
  };
}

// --- Browser-facing runJob (POST /api/compute) -------------------------

/**
 * Run a compute job from the browser by POSTing to /api/compute. Returns the
 * parsed ComputeJobResult. The route delegates to runComputeJob (inline mock now;
 * the Phase 5 worker later). Raw rows are never part of the response.
 */
export async function runJob(
  input: RunComputeJobInput
): Promise<ComputeJobResult> {
  const res = await fetch("/api/compute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      datasetIpId: input.datasetIpId,
      algoHash: input.algoHash,
      params: input.params ?? {},
    }),
  });
  return (await res.json()) as ComputeJobResult;
}
