// Confidential-compute worker (SPEC §C6). SERVER/NODE ONLY — never import this
// from a client bundle. The /api/compute route imports it server-side.
//
// HONESTY INVARIANT (must never be violated):
//   Seal does threshold IBE + on-chain-gated KEY DELIVERY only. It does NOT run
//   user algorithms on plaintext. "Private but computable" = THIS worker decrypts
//   the compute-tier dataset (via Seal's gated key delivery) INSIDE the worker,
//   runs an ALLOWLISTED, hash-pinned algorithm over the plaintext, returns ONLY
//   the result/metrics, then WIPES the plaintext. The privacy guarantee comes
//   from the worker's isolation + the per-dataset algorithm allowlist + the
//   on-chain compute_workers allowlist — NOT from Seal alone.
//
//   The worker decrypts ONLY if its operator address is on the artifact's
//   on-chain `compute_workers` allowlist. Otherwise Seal's seal_approve denies
//   key delivery and `decrypt()` throws NoAccessError — the worker logs the
//   denial and returns status:"failed" (it NEVER fakes a result).
//
//   This demo worker runs on a PLAIN server (operator-trusted). The operator can
//   in principle read plaintext in memory. We disclose this honestly in every
//   result via `isolationMode`. A production deployment would attest a hardware
//   enclave (SGX/TDX); the contract here is unchanged.

import { allowlistCheck } from "../lib/compute";
import { registerDerivative, type Clients } from "../lib/artifacts";
import { getStorage } from "../lib/storage";
import { getCrypto, sealIdBytes, SessionKey, isNoAccess } from "../lib/crypto";
import { RegistryClient } from "../lib/registry";
import { getAlgo } from "./algoRegistry";
import type { ComputeJobResult, Artifact, AttestationInfo } from "../types/artifact";

/** Honest isolation disclosure based on the currently-declared isolation mode,
 *  whether or not validator attestation actually ran. Used on every result
 *  path (rejected / failed / done) so the UI never silently shows "plain-server"
 *  when the operator declared enclave-sim. */
async function currentIsolationDisclosure(info?: AttestationInfo): Promise<string> {
  const { workerIsolation, isolationDisclosure } = await import("../lib/attestation");
  const merged: AttestationInfo = info ?? {
    validatorAttestationEnabled: false,
    enforced: false,
    untrustedValidators: 0,
    workerIsolation: workerIsolation(),
  };
  return isolationDisclosure(merged);
}

/** Input for one confidential-compute run. */
export interface WorkerInput {
  datasetIpId: `0x${string}`;
  algoHash: string;
  params?: Record<string, unknown>;
  /** Dataset allowlist. If omitted, resolved from the dataset artifact/index. */
  allowedAlgoHashes?: string[];
  /** The dataset artifact (so the worker can find the Walrus blobId in `cid`). */
  dataset?: Artifact;
  /** Sui {client, signer, address, account} bundle. Resolved from WALLET_PRIVATE_KEY
   *  if omitted. The signer's address must be on the artifact's compute_workers allowlist. */
  clients?: Clients;
}

/**
 * Decrypt the compute-tier dataset INSIDE the worker via SEAL's gated key
 * delivery, then parse the plaintext into numeric rows. Returns the rows AND the
 * raw plaintext buffer so the caller can wipe both.
 *
 * REAL-ONLY: there is NO synthetic fallback. The worker derives the Seal identity
 * for (artifactId, 'compute'), builds the seal_approve transaction kind, creates
 * a server SessionKey from its own keypair signer, reads the ciphertext blob from
 * the Walrus aggregator, and asks Seal to decrypt. Seal's seal_approve admits the
 * `compute` branch ONLY for a worker operator on the artifact's on-chain
 * `compute_workers` allowlist — so a non-allowlisted worker gets NoAccessError and
 * this THROWS (the caller turns that into status:"failed"). If the dataset has no
 * Walrus blobId, this THROWS too. No bytes leave the worker except aggregate metrics.
 */
async function decryptDataset(
  clients: Clients,
  dataset: Artifact | undefined,
  datasetIpId: `0x${string}`
): Promise<{ rows: number[][]; plaintext: Uint8Array; attestation: AttestationInfo }> {
  if (dataset === undefined) {
    throw new Error("compute: dataset descriptor missing — cannot resolve blobId/tier");
  }
  // The ciphertext blobId lives in the descriptor's `cid` (Walrus blobId, B2).
  const blobId = dataset.cid;
  if (!blobId) {
    throw new Error("compute: dataset has no Walrus blobId (cid) — cannot decrypt");
  }

  // (1) Seal identity for the COMPUTE tier of this artifact. Access is gated by
  // the on-chain `compute_workers` allowlist via the seal_approve compute branch.
  const sealId = sealIdBytes(datasetIpId, "compute");

  // (2) Build the seal_approve tx kind (binds the on-chain policy). The RegistryClient
  // is constructed read-only from the worker's SuiClient.
  const registry = new RegistryClient(clients.client);
  const txBytes = await registry.buildSealApproveTx(datasetIpId, sealId);

  // (3) Create a server SessionKey signed by the worker's OWN keypair signer.
  // Adapted from sharegraph's SessionKey.create({ address, packageId, ttlMin,
  // signer, suiClient }). The address MUST be the worker operator address that is
  // on the artifact's compute_workers allowlist — otherwise Seal denies key delivery.
  const crypto = getCrypto();
  const sessionKey = await SessionKey.create({
    address: clients.account.address,
    packageId: crypto.packageId,
    ttlMin: 10,
    signer: clients.signer as never,
    suiClient: clients.client as never,
  });

  const { getAttestationConfig, attestationEnforced, workerIsolation } = await import("../lib/attestation");
  const attCfg = getAttestationConfig();

  // (4) Read ciphertext from the gasless Walrus aggregator + Seal-decrypt.
  // Fail closed on NoAccess: a non-allowlisted worker is DENIED here. Never retry.
  let plaintext: Uint8Array;
  try {
    const ciphertext = await getStorage().readViaAggregator(blobId);
    plaintext = await crypto.decrypt(ciphertext, sessionKey, txBytes);
  } catch (e) {
    if (isNoAccess(e)) {
      // On-chain compute_workers allowlist denied this worker. Honest denial —
      // NEVER fabricate plaintext or a result. (No secrets/plaintext are logged.)
      throw new Error(
        "compute: access denied — worker is not on the artifact's compute_workers allowlist (Seal NoAccess)"
      );
    }
    throw e;
  }

  const attestation: AttestationInfo = {
    validatorAttestationEnabled: !!attCfg,
    enforced: attestationEnforced(attCfg),
    untrustedValidators: 0,
    workerIsolation: workerIsolation(),
  };

  let rows: number[][];
  try {
    rows = parseRows(plaintext);
  } catch (e) {
    plaintext.fill(0); // wipe before propagating — never leave decrypted bytes in memory
    throw e;
  }
  return { rows, plaintext, attestation };
}

/**
 * Parse decrypted plaintext into a numeric matrix. Accepts JSON shapes
 * ([[...],[...]] matrix, flat [n,...] vector, or {values:[...]}) AND CSV — the
 * sample datasets are uploaded as CSV (e.g. "month,region,units,revenue_usd"),
 * so a JSON-only parser fails on the header row. We detect the shape by the
 * first non-whitespace char and fall back to CSV otherwise.
 *
 * Exported for unit testing.
 */
export function parseRows(bytes: Uint8Array): number[][] {
  const text = new TextDecoder().decode(bytes).trim();
  if (!text) throw new Error("worker: empty dataset");

  // JSON if it opens with a bracket/brace; CSV otherwise.
  if (text[0] === "[" || text[0] === "{") {
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

  return parseCsv(text);
}

/**
 * CSV → numeric matrix. Drops an all-non-numeric header row and any column that
 * is not numeric across every data row (e.g. a categorical "region" column).
 * The allowlisted algorithms operate on numeric columns only, so this keeps the
 * matrix rectangular and well-typed without silently coercing strings to NaN.
 */
function parseCsv(text: string): number[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("worker: empty CSV");

  const cells = lines.map((l) => l.split(",").map((c) => c.trim()));
  const isNum = (s: string) => s !== "" && Number.isFinite(Number(s));

  // Header = first row with no numeric cell at all (e.g. "month,region,...").
  const start = cells[0].every((c) => !isNum(c)) ? 1 : 0;
  const dataRows = cells.slice(start);
  if (dataRows.length === 0) throw new Error("worker: CSV has no data rows");

  // Keep only columns numeric in EVERY data row (drops categoricals like region).
  const width = dataRows[0].length;
  const keep: number[] = [];
  for (let c = 0; c < width; c++) {
    if (dataRows.every((r) => c < r.length && isNum(r[c]))) keep.push(c);
  }
  if (keep.length === 0) throw new Error("worker: CSV has no numeric columns");

  return dataRows.map((r) => keep.map((c) => Number(r[c])));
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
 *   3. SEAL-decrypt INSIDE the worker (gated by on-chain compute_workers);
 *   4. run the allowlisted algo;
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
      isolationMode: await currentIsolationDisclosure(),
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

  // Pre-attestation: if the operator declared enclave-sim mode, generate +
  // verify a sim TEE quote BEFORE any decryption. The sim verification result
  // is bound to the algoHash and the worker EOA, then surfaced in the result.
  // This exercises the same code path real hardware attestation would take.
  const { workerIsolation: declaredIsolation } = await import("../lib/attestation");
  const isolationModeNow = declaredIsolation();
  let preSimQuote: import("../types/artifact").SimulatedQuoteInfo | undefined;
  let preSimVerified: boolean | undefined;
  if (isolationModeNow === "enclave-sim") {
    const { generateSimulatedQuote, verifySimulatedQuote } = await import("../lib/tee-sim");
    const q = generateSimulatedQuote({
      workerIdentity: clients.account.address as `0x${string}`,
      algoHash: input.algoHash,
    });
    const expectMrEnclave = process.env.WORKER_SIM_EXPECT_MRENCLAVE as `0x${string}` | undefined;
    const expectMrSigner = process.env.WORKER_SIM_EXPECT_MRSIGNER as `0x${string}` | undefined;
    const expectMinSvnRaw = process.env.WORKER_SIM_MIN_SVN;
    const verdict = verifySimulatedQuote(q, {
      expectedMrEnclave: expectMrEnclave,
      expectedMrSigner: expectMrSigner,
      minSecurityVersion: expectMinSvnRaw ? Number(expectMinSvnRaw) : undefined,
    });
    preSimQuote = q as unknown as import("../types/artifact").SimulatedQuoteInfo;
    preSimVerified = verdict.ok;
    if (!verdict.ok) {
      // Enforced mismatch is a loud failure: refuse to run rather than silently
      // pretending the simulator is good. Honest failure beats silent success.
      throw new Error(
        "compute worker: enclave-sim verification failed — " + verdict.reasons.join("; ")
      );
    }
  }

  // STEP 3: SEAL-decrypt the dataset INSIDE the worker (gated by compute_workers).
  let plaintext: Uint8Array | null = null;
  let rows: number[][] | null = null;
  let scratchCleared = false;
  let attestationOut: AttestationInfo | undefined;
  try {
    const dec = await decryptDataset(clients, input.dataset, input.datasetIpId);
    plaintext = dec.plaintext;
    rows = dec.rows;
    attestationOut = {
      ...dec.attestation,
      simQuote: preSimQuote,
      simVerified: preSimVerified,
    };

    // STEP 4: run the ALLOWLISTED algorithm over the plaintext rows.
    const algoOut = algo.run(rows, input.params) as Record<string, unknown>;

    // Flatten to a numeric metrics map (ComputeJobResult.metrics). Arrays are
    // expanded as col0,col1,... — still aggregates, never raw rows.
    const metrics = toMetrics(algoOut);

    // STEP 5: register the RESULT as a DERIVATIVE of the dataset so royalties
    // flow upstream to the dataset IP via on-chain parent lineage. Only metrics
    // are persisted (Seal-encrypted + published), never raw rows. In the Sui
    // model lineage is the on-chain `parent` edge (register_derivative) — there
    // are no off-chain license-terms ids to gate on, so we register unconditionally.
    let resultIpId: `0x${string}` | undefined;
    let resultTx: `0x${string}` | undefined;
    let warning: string | undefined;
    {
      try {
        const child = await registerDerivative(clients, {
          parentIpId: input.datasetIpId,
          bytes: new TextEncoder().encode(JSON.stringify({ metrics })),
          meta: {
            title: `Compute result (${algo.name})`,
            description:
              "Aggregate compute result derived in the confidential-compute worker. Metrics only — the source dataset's raw rows never left the worker.",
            tags: ["compute-result", algo.name, "derivative"],
            creators: [
              {
                name: "Reef Compute Worker",
                address: clients.account.address as `0x${string}`,
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
      isolationMode: await currentIsolationDisclosure(attestationOut),
      decryptCalled: true,
      scratchCleared,
      warning,
      attestation: attestationOut,
    };
  } catch (e) {
    // On any failure, still wipe whatever plaintext we hold — then verify it.
    wipe(plaintext, rows);
    const cleared = isCleared(plaintext, rows);
    plaintext = null;
    rows = null;
    // Build an AttestationInfo even on failure — the sim quote (if present)
    // is generated BEFORE decrypt, so it should travel with the result so the
    // caller can see what was attested even when the job fell over downstream.
    const failedAttestation: AttestationInfo | undefined = preSimQuote
      ? {
          validatorAttestationEnabled: false,
          enforced: false,
          untrustedValidators: 0,
          workerIsolation: isolationModeNow,
          simQuote: preSimQuote,
          simVerified: preSimVerified,
        }
      : undefined;
    return {
      status: "failed",
      reason: (e as Error).message,
      isolationMode: await currentIsolationDisclosure(failedAttestation),
      decryptCalled: true,
      scratchCleared: cleared,
      attestation: failedAttestation,
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
