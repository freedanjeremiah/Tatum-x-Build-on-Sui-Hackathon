// Addendum §C6 — Confidential compute job (SIMULATED).
//
// Proves the access + allowlist invariants:
//   1. consumer mints a COMPUTE license (distinct terms id),
//   2. worker checks algoHash ∈ allowedAlgoHashes BEFORE any decryption,
//   3. only on an allowlisted algo does it CDR-decrypt the dataset,
//   4. it runs the allowlisted algo and registers the result as a derivative,
//   5. it returns ONLY metrics — never the raw rows.
// A second job with an off-allowlist algo is rejected and never decrypts.
//
// Compute helpers (allowlistCheck/submitJob/runJob) live in lib/compute; the
// dataset upload uses lib/artifacts.uploadCompute. The real worker is Phase 5.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/08-compute-job.ts

import { getClients, logTx } from "./_util";
import { IS_MOCK } from "../lib/env";
import { PUBLIC_SPG_COLLECTION } from "../lib/constants";
import { uploadCompute } from "../lib/artifacts";
import { allowlistCheck, submitJob, type ComputeResult } from "../lib/compute";
import { encodeAccessAuxData } from "../lib/licensing";
import { heliaProvider } from "../lib/storage";
import type { ComputeJob } from "../types/artifact";

const ALLOWED_ALGOS = ["sha256:mean-aggregate", "sha256:logistic-regression"];

async function main() {
  const clients = await getClients();
  const { cdr, story } = clients as any;
  const owner = (clients.account as any).address as `0x${string}`;
  const storageProvider = await heliaProvider();

  // --- Dataset owner: register a compute-enabled dataset IP and vault its rows ---
  const rows = [10, 20, 30, 40, 50];
  const payload = new TextEncoder().encode(JSON.stringify({ values: rows }));
  const dataset = await uploadCompute(clients as any, {
    bytes: payload,
    meta: {
      title: "Confidential Numeric Rows",
      description: "Compute-enabled dataset; raw rows never leave the enclave.",
      tags: ["dataset", "compute"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
    allowedAlgoHashes: ALLOWED_ALGOS,
  });
  const datasetIpId = dataset.ipId;
  const datasetUuid = dataset.vaultUuid!;
  logTx("register + vault dataset", dataset.createdTx);

  // Consumer mints a COMPUTE license (distinct terms id from a plain read).
  const mint = await story.license.mintLicenseTokens({
    licensorIpId: datasetIpId,
    licenseTermsId: BigInt(dataset.computeLicenseTermsId!),
    amount: 1,
  });
  const computeLicenseTokenId = mint.licenseTokenIds[0] as bigint;
  logTx("mint compute license", mint.txHash);

  // The access token the (mock) vault will accept for this dataset.
  const accessAux = IS_MOCK
    ? await cdr.__mintFor(datasetIpId)
    : encodeAccessAuxData([computeLicenseTokenId]);

  // ---- Worker simulation (real worker = Phase 5) ----
  async function worker(job: ComputeJob): Promise<ComputeResult> {
    // (a) verify the license token (mock: presence is enough).
    if (!job.computeLicenseTokenId) return { status: "rejected" };
    // (b) allowlist gate — BEFORE any decryption.
    if (!allowlistCheck(job.algoHash, ALLOWED_ALGOS)) {
      return { status: "rejected", decryptCalled: false };
    }
    // (c) only now CDR-decrypt the dataset.
    const out = await cdr.consumer.downloadFile({
      uuid: datasetUuid,
      accessAuxData: accessAux,
      storageProvider,
    });
    const parsed = JSON.parse(new TextDecoder().decode(out.content)) as { values: number[] };
    // (d) run the allowlisted algorithm (trivial mean aggregate).
    const mean = parsed.values.reduce((a, b) => a + b, 0) / parsed.values.length;
    // (e) register the RESULT as a derivative of the dataset.
    const res = await story.ipAsset.registerDerivativeIpAsset({
      nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
      derivData: { parentIpIds: [datasetIpId], licenseTermsIds: [dataset.computeLicenseTermsId!] },
      ipMetadata: {},
    });
    // (f) return ONLY metrics — never the raw rows.
    return {
      status: "done",
      metrics: { mean, count: parsed.values.length },
      resultIpId: res.ipId,
      decryptCalled: true,
    };
  }

  console.log("=== 08-compute-job (Addendum §C6, simulated) ===");

  // Job 1: allowlisted algo → completes with metrics only.
  const job1 = submitJob({
    datasetIpId,
    consumer: owner,
    algoHash: "sha256:mean-aggregate",
    computeLicenseTokenId,
  });
  // runJob now POSTs to /api/compute (browser path); this script drives the
  // worker fn directly to prove the same allowlist + results-only invariants.
  const r1 = await worker(job1);
  if (r1.status !== "done") throw new Error("job1 should have completed");
  if (r1.metrics && ("values" in r1.metrics || "rows" in r1.metrics)) {
    throw new Error("compute result leaked raw rows");
  }
  console.log("job1 algo:", job1.algoHash);
  console.log("job1 status:", r1.status, "| metrics:", JSON.stringify(r1.metrics));
  console.log("job1 resultIpId:", r1.resultIpId);
  console.log("✓ job1 done — only metrics returned, raw rows never exposed");

  // Job 2: off-allowlist algo → rejected, decrypt never called.
  const job2 = submitJob({
    datasetIpId,
    consumer: owner,
    algoHash: "sha256:dump-all-rows",
    computeLicenseTokenId,
  });
  const r2 = await worker(job2);
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
