// Confidential compute job (REAL worker).
//
// Proves the access + allowlist invariants against the real chain:
//   1. Upload a compute-enabled dataset (Seal-encrypted blob on Walrus + on-chain
//      registration),
//   2. Drive runComputeJob from worker/compute-worker with an ALLOWLISTED algo:
//      - worker checks algoHash ∈ allowedAlgoHashes BEFORE any decryption,
//      - mints a real compute license, presents it so Seal delivers the key,
//      - runs the hash-pinned algo and registers the result as a derivative,
//      - returns ONLY metrics — never raw rows.
//   3. Drive a second job with an OFF-allowlist algo: the real worker rejects it
//      and provably never calls Seal decrypt (decryptCalled: false).
//
// Compute helpers live in lib/compute; the dataset upload uses lib/artifacts.uploadCompute.
// The confidential-compute worker is worker/compute-worker.ts.
//
// Run: pnpm tsx scripts/08-compute-job.ts  (requires WALLET_PRIVATE_KEY in .env.local)

import { getClients, logTx, selfIndex } from "./_util";
import { uploadCompute } from "../lib/artifacts";
import { runComputeJob } from "../worker/compute-worker";
import type { Clients } from "../lib/artifacts";

const ALLOWED_ALGOS = ["sha256:mean-aggregate", "sha256:logistic-regression"];

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  // --- Dataset owner: register a compute-enabled dataset IP and vault its rows ---
  const rows = [10, 20, 30, 40, 50];
  const payload = new TextEncoder().encode(JSON.stringify({ values: rows }));
  const dataset = await uploadCompute(clients as unknown as Clients, {
    bytes: payload,
    meta: {
      title: "Confidential Numeric Rows",
      description: "Compute-enabled dataset; raw rows never leave the enclave.",
      tags: ["dataset", "compute"],
      creators: [{ name: "Tessera Demo", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
    // Explicit terms — no silent default.
    terms: { rev: 5, fee: 1n },
    allowedAlgoHashes: ALLOWED_ALGOS,
  });
  const datasetIpId = dataset.ipId;
  logTx("register + vault dataset", dataset.createdTx);
  await selfIndex(dataset as unknown as Record<string, unknown>);

  console.log("=== 08-compute-job (Addendum §C6, real worker) ===");
  console.log("datasetIpId:", datasetIpId);
  console.log("vaultUuid:", dataset.vaultUuid);
  console.log("computeLicenseTermsId:", dataset.computeLicenseTermsId);

  // Job 1: allowlisted algo → real worker decrypts via Seal, runs mean-aggregate,
  // registers the result as a derivative, returns metrics only.
  console.log("\n--- Job 1: allowlisted algo (sha256:mean-aggregate) ---");
  const r1 = await runComputeJob({
    datasetIpId,
    algoHash: "sha256:mean-aggregate",
    allowedAlgoHashes: ALLOWED_ALGOS,
    dataset,
    clients: clients as unknown as import("../lib/artifacts").Clients,
  });
  console.log("job1 status:", r1.status);
  console.log("job1 metrics:", JSON.stringify(r1.metrics));
  console.log("job1 resultIpId:", r1.resultIpId);
  console.log("job1 isolationMode:", r1.isolationMode);
  console.log("job1 decryptCalled:", r1.decryptCalled);
  console.log("job1 scratchCleared:", r1.scratchCleared);
  if (r1.resultTx) logTx("job1 derivative tx", r1.resultTx);
  if (r1.status !== "done") throw new Error(`job1 expected done, got: ${r1.status} — ${r1.reason}`);
  if (r1.metrics && ("values" in r1.metrics || "rows" in r1.metrics)) {
    throw new Error("compute result leaked raw rows");
  }
  console.log("✓ job1 done — only metrics returned, raw rows never exposed");

  // Job 2: off-allowlist algo → real worker rejects before any Seal decryption.
  console.log("\n--- Job 2: off-allowlist algo (sha256:dump-all-rows) ---");
  const r2 = await runComputeJob({
    datasetIpId,
    algoHash: "sha256:dump-all-rows",
    allowedAlgoHashes: ALLOWED_ALGOS,
    dataset,
    clients: clients as unknown as import("../lib/artifacts").Clients,
  });
  console.log("job2 status:", r2.status);
  console.log("job2 decryptCalled:", r2.decryptCalled);
  if (r2.status !== "rejected") throw new Error(`job2 expected rejected, got: ${r2.status}`);
  if (r2.decryptCalled) throw new Error("job2 must NOT decrypt off-allowlist data");
  console.log("✓ job2 rejected — off-allowlist algo never triggered decryption");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
