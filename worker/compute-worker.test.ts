import { test, expect } from "vitest";
import { runComputeJob, parseRows } from "./compute-worker";
import { RUN_INTEGRATION, realClients } from "../lib/itest";
import type { Artifact } from "../types/artifact";

const itInt = test.skipIf(!RUN_INTEGRATION);

const enc = (s: string) => new TextEncoder().encode(s);

// PURE: dataset-shape parsing. CSV is the real seed format, so a JSON-only
// parser fails on the header row (the original /api/compute 500).
test("parseRows: CSV with header + categorical column → numeric matrix", () => {
  const csv = "month,region,units,revenue_usd\n1,NA,200,4000\n2,EU,300,9000";
  // header dropped; non-numeric "region" column dropped; month/units/revenue kept
  expect(parseRows(enc(csv))).toEqual([
    [1, 200, 4000],
    [2, 300, 9000],
  ]);
});

test("parseRows: all-numeric CSV with no header keeps every row", () => {
  expect(parseRows(enc("1,2,3\n4,5,6"))).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("parseRows: JSON shapes still parse", () => {
  expect(parseRows(enc("[[1,2],[3,4]]"))).toEqual([[1, 2], [3, 4]]);
  expect(parseRows(enc('{"values":[5,6,7]}'))).toEqual([[5], [6], [7]]);
});

const DATASET = "0xcmp0000000000000000000000000000000000005" as `0x${string}`;
const ALLOWED = ["sha256:mean-aggregate", "sha256:logistic-regression"];

// PURE: the allowlist gate returns BEFORE any client/CDR use, so this needs no
// clients and no chain. Off-allowlist (or unregistered) algo must be rejected
// with decryptCalled provably false.
test("off-allowlist job → rejected, decrypt NEVER invoked", async () => {
  const result = await runComputeJob({
    datasetIpId: DATASET,
    algoHash: "sha256:dump-all-rows",
    allowedAlgoHashes: ALLOWED,
    // no clients: the gate refuses before any client is resolved
  });

  expect(result.status).toBe("rejected");
  expect(result.decryptCalled).toBe(false);
  expect(result.metrics).toBeUndefined();
  expect(result.resultIpId).toBeUndefined();
});

// A real compute dataset artifact (must exist on-chain with a CDR vault) for the
// integration runs. Supply via env so the worker can resolve vaultUuid/terms.
function realDataset(): Artifact {
  return {
    ipId: (process.env.COMPUTE_DATASET_IPID ?? DATASET) as `0x${string}`,
    tier: "compute",
    modality: "dataset",
    title: "Integration compute dataset",
    description: "Live dataset for confidential-compute integration tests.",
    tags: ["compute", "integration"],
    ipMetadataURI: process.env.COMPUTE_DATASET_META ?? "ipfs://bafyComputeMeta",
    vaultUuid: Number(process.env.COMPUTE_DATASET_VAULT ?? "0"),
    cid: process.env.COMPUTE_DATASET_CID ?? "bafyCompute",
    licenseTermsId: process.env.COMPUTE_DATASET_TERMS ?? "1",
    computeLicenseTermsId: process.env.COMPUTE_DATASET_COMPUTE_TERMS,
    createdTx: "0x0",
    computeEnabled: true,
    allowedAlgoHashes: ALLOWED,
  };
}

itInt("allowed job → done, metrics, resultIpId, decrypt called, NO raw rows", async () => {
  const clients = await realClients();
  const dataset = realDataset();
  const result = await runComputeJob({
    datasetIpId: dataset.ipId,
    algoHash: "sha256:mean-aggregate",
    allowedAlgoHashes: ALLOWED,
    dataset,
    clients: clients as any,
  });

  expect(result.status).toBe("done");
  expect(result.decryptCalled).toBe(true);
  expect(result.metrics).toBeTruthy();
  expect(result.isolationMode).toContain("operator-trusted");
  // RESULTS ONLY: raw rows must never appear anywhere in the output.
  const blob = JSON.stringify(result);
  expect(blob).not.toContain('"rows"');
  expect(blob).not.toContain('"values"');
});

itInt("plaintext scratch is wiped after a completed job", async () => {
  const clients = await realClients();
  const dataset = realDataset();
  const result = await runComputeJob({
    datasetIpId: dataset.ipId,
    algoHash: "sha256:logistic-regression",
    allowedAlgoHashes: ALLOWED,
    dataset,
    clients: clients as any,
  });
  expect(result.status).toBe("done");
  expect(result.scratchCleared).toBe(true);
});

itInt("logistic-regression returns coefficients-only metrics (no rows)", async () => {
  const clients = await realClients();
  const dataset = realDataset();
  const result = await runComputeJob({
    datasetIpId: dataset.ipId,
    algoHash: "sha256:logistic-regression",
    allowedAlgoHashes: ALLOWED,
    dataset,
    clients: clients as any,
  });
  expect(result.status).toBe("done");
  expect(result.metrics).toBeTruthy();
  expect("rows" in (result.metrics ?? {})).toBe(false);
  expect("values" in (result.metrics ?? {})).toBe(false);
});
