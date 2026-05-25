// Addendum §C6 — Confidential compute job (SIMULATED).
//
// The real confidential-compute worker is Phase 5. Here we simulate it inline to
// prove the access + allowlist invariants:
//   1. consumer mints a COMPUTE license (distinct terms id),
//   2. worker verifies the token, then checks algoHash ∈ allowedAlgoHashes,
//   3. only on an allowlisted algo does it CDR-decrypt the dataset,
//   4. it runs an allowlisted algo and registers the result as a derivative,
//   5. it returns ONLY metrics — never the raw rows.
// A second job with an off-allowlist algo is rejected and never decrypts.
//
// HONESTY: CDR does key-delivery only; compute privacy = worker isolation +
// allowlist, not CDR. (The CDR worker decrypts inside an isolated enclave and
// only runs allowlisted algorithms — it does not "compute on ciphertext".)
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/08-compute-job.ts

import { randomUUID } from "node:crypto";

import { getClients, logTx } from "./_util";
import { IS_MOCK } from "../lib/env";
import { PUBLIC_SPG_COLLECTION } from "../lib/constants";
import type { ComputeJob } from "../types/artifact";

const ALLOWED_ALGOS = ["sha256:mean-aggregate", "sha256:logistic-regression"];

async function makeStorageProvider() {
  return { CID: (s: string) => s } as any; // VERIFY: HeliaProvider in real mode.
}

// The result a compute job returns. Note: NO raw rows — only derived metrics.
interface ComputeResult {
  status: ComputeJob["status"];
  metrics?: Record<string, number>;
  resultIpId?: `0x${string}`;
  decryptCalled: boolean;
}

async function main() {
  const { cdr, story, account } = await getClients();
  const owner = (account as any).address as `0x${string}`;
  const storageProvider = await makeStorageProvider();

  // --- Dataset owner: register a compute-enabled dataset IP and vault its rows ---
  const ds = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: { commercialUse: true } }],
    ipMetadata: {},
  } as any);
  const datasetIpId = (ds as any).ipId as `0x${string}`;
  logTx("register dataset", (ds as any).txHash);

  // Vault the confidential numeric rows (CSV-ish payload).
  const rows = [10, 20, 30, 40, 50];
  const payload = new TextEncoder().encode(JSON.stringify({ values: rows }));
  const up = await cdr.uploader.uploadFile({
    content: payload,
    storageProvider,
    globalPubKey: await cdr.observer.getGlobalPubKey(),
    updatable: false,
    readConditionData: IS_MOCK ? datasetIpId : ("0x" as any),
    accessAuxData: "0x",
  } as any);
  const datasetUuid = (up as any).uuid;
  logTx("vault dataset", (up as any).txHash);

  // Consumer mints a COMPUTE license (distinct terms id).
  const COMPUTE_TERMS = "2005"; // distinct from a plain read license
  const mint = await story.license.mintLicenseTokens({
    licensorIpId: datasetIpId,
    licenseTermsId: BigInt(COMPUTE_TERMS),
    amount: 1,
  } as any);
  const computeLicenseTokenId = (mint as any).licenseTokenIds[0] as bigint;
  logTx("mint compute license", (mint as any).txHash);

  // The access token the (mock) vault will accept for this dataset.
  const accessAux = IS_MOCK
    ? await (cdr as any).__mintFor(datasetIpId)
    : "0x"; // VERIFY: real = ABI-encoded uint256[] of compute license token ids

  // ---- Inline worker simulation (real worker = Phase 5) ----
  async function runJob(job: ComputeJob): Promise<ComputeResult> {
    // (a) verify the license token (mock: presence is enough).
    if (!job.computeLicenseTokenId) {
      return { status: "rejected", decryptCalled: false };
    }
    // (b) allowlist gate — BEFORE any decryption.
    if (!ALLOWED_ALGOS.includes(job.algoHash)) {
      // Rejected: no decrypt happens.
      return { status: "rejected", decryptCalled: false };
    }
    // (c) only now CDR-decrypt the dataset.
    let decryptCalled = false;
    const out = await cdr.consumer.downloadFile({
      uuid: datasetUuid,
      accessAuxData: accessAux,
      storageProvider,
    } as any);
    decryptCalled = true;
    const parsed = JSON.parse(new TextDecoder().decode((out as any).content)) as { values: number[] };
    // (d) run the allowlisted algorithm (trivial mean aggregate).
    const mean = parsed.values.reduce((a, b) => a + b, 0) / parsed.values.length;
    // (e) register the RESULT as a derivative of the dataset.
    const res = await story.ipAsset.registerDerivativeIpAsset({
      nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
      derivData: { parentIpIds: [datasetIpId], licenseTermsIds: [COMPUTE_TERMS] },
      ipMetadata: {},
    } as any);
    // (f) return ONLY metrics — never the raw rows.
    return {
      status: "done",
      metrics: { mean, count: parsed.values.length },
      resultIpId: (res as any).ipId,
      decryptCalled,
    };
  }

  console.log("=== 08-compute-job (Addendum §C6, simulated) ===");

  // Job 1: allowlisted algo → completes with metrics only.
  const job1: ComputeJob = {
    id: randomUUID(),
    datasetIpId,
    consumer: owner,
    algoHash: "sha256:mean-aggregate",
    computeLicenseTokenId,
    status: "pending",
  };
  const r1 = await runJob(job1);
  if (r1.status !== "done") throw new Error("job1 should have completed");
  // Assert the result object carries NO raw rows.
  if ("values" in (r1.metrics as object) || "rows" in (r1.metrics as object)) {
    throw new Error("compute result leaked raw rows");
  }
  console.log("job1 algo:", job1.algoHash);
  console.log("job1 status:", r1.status, "| metrics:", JSON.stringify(r1.metrics));
  console.log("job1 resultIpId:", r1.resultIpId);
  console.log("✓ job1 done — only metrics returned, raw rows never exposed");

  // Job 2: off-allowlist algo → rejected, decrypt never called.
  const job2: ComputeJob = {
    id: randomUUID(),
    datasetIpId,
    consumer: owner,
    algoHash: "sha256:dump-all-rows",
    computeLicenseTokenId,
    status: "pending",
  };
  const r2 = await runJob(job2);
  if (r2.status !== "rejected") throw new Error("job2 should have been rejected");
  if (r2.decryptCalled) throw new Error("job2 must NOT decrypt off-allowlist data");
  console.log("job2 algo:", job2.algoHash);
  console.log("job2 status:", r2.status, "| decryptCalled:", r2.decryptCalled);
  console.log("✓ job2 rejected — off-allowlist algo never triggered decryption");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
