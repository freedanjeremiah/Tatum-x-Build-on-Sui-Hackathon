// End-to-end demo: confidential-compute worker running in TEE-SIM mode.
//
// This drives the REAL worker (worker/compute-worker.ts) with
// WORKER_ISOLATION_MODE=enclave-sim, exercising the same code path real SGX/TDX
// attestation would take. Seal key-server attestation is OFF here (real key-server
// attestation requires reachable key servers that emit SGX quotes);
// WORKER_ISOLATION_MODE=enclave-sim only attests the WORKER process.
//
// What the script proves:
//   1. The worker generates + verifies a sim TEE quote BEFORE any decrypt.
//   2. The sim quote is structurally a SGX-style header+body+HMAC, but the
//      header.teeType is "SGX-SIM" and the kind marker is "sim-sgx-quote" —
//      a real attestation verifier (Intel DCAP / Azure Attestation / a Seal
//      key-server's enclave check) will reject this kind out of hand. No forgery surface.
//   3. The result.isolationMode honestly says "SIMULATED enclave … NOT
//      hardware-attested" instead of the prior "plain-server" string.
//   4. When the allowlist fails (off-allowlist algorithm), the rejection still
//      reports the sim isolation mode honestly (no plain-server lie).
//   5. When the dataset has no Seal-gated blob, decryption throws — the sim quote is
//      STILL surfaced in the failed result so callers can see what was attested
//      pre-decrypt.
//
// Run: WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret \
//      WALLET_PRIVATE_KEY=0x… pnpm exec tsx scripts/06-enclave-sim-demo.ts

import { runComputeJob } from "../worker/compute-worker";
import { generateSimulatedQuote, verifySimulatedQuote } from "../lib/tee-sim";
import type { Artifact } from "../types/artifact";

const ALGO_ALLOWED = ["sha256:mean-aggregate", "sha256:logistic-regression"];

const DATASET_IPID = "0xc0ffee00000000000000000000000000ec0ffee0" as `0x${string}`;

function header(label: string) {
  console.log("\n=== " + label + " ===");
}

function showResult(tag: string, r: unknown) {
  console.log(`\n--- ${tag} ---`);
  console.log(JSON.stringify(r, null, 2));
}

async function main() {
  if (process.env.WORKER_ISOLATION_MODE !== "enclave-sim") {
    console.warn(
      "[demo] WORKER_ISOLATION_MODE is not 'enclave-sim'. Set it to exercise the sim path:",
      "\n   WORKER_ISOLATION_MODE=enclave-sim pnpm exec tsx scripts/06-enclave-sim-demo.ts",
    );
  }

  // -----------------------------------------------------------------
  // (A) Direct sim verification — purely cryptographic, no clients/chain.
  // -----------------------------------------------------------------
  header("A. Generate + verify a TEE-SIM quote directly");
  const directQuote = generateSimulatedQuote({
    workerIdentity: "0x29bCb9811A60434514c245629DCE2FE4843E3C50",
    algoHash: "sha256:mean-aggregate",
    jobNonce: "demo-nonce-001",
  });
  const directVerdict = verifySimulatedQuote(directQuote);
  showResult("direct quote", {
    kind: directQuote.kind,
    teeType: directQuote.header.teeType,
    mrEnclave: directQuote.body.mrEnclave,
    mrSigner: directQuote.body.mrSigner,
    isvSvn: directQuote.body.isvSvn,
    signature: directQuote.signature,
    disclosure: directQuote.disclosure,
  });
  console.log("verify:", directVerdict);

  // -----------------------------------------------------------------
  // (B) Drive the real worker with a deliberately off-allowlist algorithm.
  //     The allowlist gate fires before any sim-attestation step, so this
  //     branch demonstrates the disclosure picks up enclave-sim from the
  //     environment even when no quote was generated.
  // -----------------------------------------------------------------
  header("B. Worker rejects off-allowlist algorithm (gate before any decrypt)");
  const rejected = await runComputeJob({
    datasetIpId: DATASET_IPID,
    algoHash: "sha256:dump-all-rows",
    allowedAlgoHashes: ALGO_ALLOWED,
  });
  showResult("rejected result", rejected);

  // -----------------------------------------------------------------
  // (C) Allowed algorithm + a dataset with no real stored blob. The sim
  //     pre-attestation runs; then decrypt throws because we never
  //     provisioned a blob. The failed result carries the sim quote so the
  //     caller can see exactly what was attested before the downstream fault.
  // -----------------------------------------------------------------
  header("C. Worker runs pre-attestation, then decrypt fails (no real blob)");
  const dataset: Artifact = {
    ipId: DATASET_IPID,
    tier: "compute",
    modality: "dataset",
    title: "Sim demo dataset (no real blob)",
    description: "Demonstration only; no stored blob provisioned.",
    tags: ["demo"],
    ipMetadataURI: "walrus://demo",
    createdTx: "0x0" as `0x${string}`,
    computeEnabled: true,
    allowedAlgoHashes: ALGO_ALLOWED,
  };
  let failed;
  try {
    failed = await runComputeJob({
      datasetIpId: DATASET_IPID,
      algoHash: "sha256:mean-aggregate",
      allowedAlgoHashes: ALGO_ALLOWED,
      dataset,
    });
  } catch (e) {
    failed = { thrown: (e as Error).message };
  }
  showResult("failed result (pre-attested then fell over)", failed);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
