// Compute helpers: allowlist gating, ComputeJob construction, the runComputeJob
// worker contract, and a browser-facing runJob that POSTs to /api/compute.
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
 * The worker contract implemented by worker/compute-worker.ts. The /api/compute
 * route calls it.
 *
 * Worker runs OUTSIDE CDR. CDR is gated key-delivery only. Compute privacy =
 * this worker's isolation + the per-dataset algorithm allowlist.
 */
export type RunComputeJob = (
  input: RunComputeJobInput
) => Promise<ComputeJobResult>;

/** Human-friendly names for the seed's hash-pinned algorithms. */
export const ALGO_NAMES: Record<string, string> = {
  "sha256:mean-aggregate": "Mean aggregate (DP-friendly)",
  "sha256:logistic-regression": "Logistic regression (coefficients only)",
};

export function algoName(hash: string): string {
  return ALGO_NAMES[hash] ?? hash.replace(/^sha256:/, "");
}

// --- Browser-facing runJob (POST /api/compute) -------------------------

/**
 * Run a compute job from the browser by POSTing to /api/compute. Returns the
 * parsed ComputeJobResult. The route delegates to the worker's runComputeJob.
 * Raw rows are never part of the response.
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
