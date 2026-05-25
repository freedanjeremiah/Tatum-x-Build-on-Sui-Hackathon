// Compute helpers: allowlist gating, ComputeJob construction, and a runJob
// indirection. runJob delegates to a passed-in runner fn so it is testable; the
// real HTTP wiring (POST /api/compute) lands in Phase 4.
//
// HONESTY: CDR does key-delivery only; compute privacy = worker isolation +
// allowlist, not CDR. A compute result returns ONLY metrics — never raw rows.

import { randomUUID } from "node:crypto";
import type { ComputeJob } from "../types/artifact";

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
    id: randomUUID(),
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

/**
 * Run a compute job. For now this delegates to a passed-in runner fn so it is
 * testable; the real HTTP wiring (POST /api/compute) lands in Phase 4.
 */
export async function runJob(job: ComputeJob, runner: ComputeRunner): Promise<ComputeResult> {
  return runner(job);
}
