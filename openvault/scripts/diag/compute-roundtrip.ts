// Diagnostic: upload a fresh compute artifact NOW and try to decrypt it via the
// worker, end-to-end. This isolates whether a revert is in the CURRENT code or
// in an OLD vault sealed by a previous condition.
//
// Run: pnpm real scripts/diag/compute-roundtrip.ts

import { getClients } from "../_util";
import { uploadCompute, type Clients } from "../../lib/artifacts";
import { runComputeJob } from "../../worker/compute-worker";

const ALLOWED = ["sha256:mean-aggregate", "sha256:logistic-regression"];

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;
  console.log("operator:", owner);

  const payload = new TextEncoder().encode(JSON.stringify({ values: [1, 2, 3, 4, 5] }));
  console.log("[1] uploadCompute…");
  const dataset = await uploadCompute(clients as unknown as Clients, {
    bytes: payload,
    meta: {
      title: "DIAG-compute-roundtrip",
      description: "Throwaway dataset for compute decrypt diagnostic.",
      tags: ["diag"],
      creators: [{ name: "DIAG", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
    terms: { rev: 5, fee: 1n },
    allowedAlgoHashes: ALLOWED,
  });
  console.log("  ipId:", dataset.ipId);
  console.log("  vaultUuid:", dataset.vaultUuid);
  console.log("  computeLicenseTermsId:", dataset.computeLicenseTermsId);

  console.log("[2] runComputeJob…");
  const result = await runComputeJob({
    datasetIpId: dataset.ipId,
    algoHash: "sha256:mean-aggregate",
    allowedAlgoHashes: ALLOWED,
    dataset,
    clients: clients as unknown as Clients,
  });
  console.log("status:", result.status);
  if (result.reason) console.log("reason:", result.reason);
  if (result.metrics) console.log("metrics:", JSON.stringify(result.metrics));
  if (result.resultIpId) console.log("resultIpId:", result.resultIpId);
  if (result.warning) console.log("warning:", result.warning);
}

main().catch((e) => { console.error(e); process.exit(1); });
