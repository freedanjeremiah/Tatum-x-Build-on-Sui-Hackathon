import { test, expect, vi } from "vitest";
import { runComputeJob } from "./compute-worker";
import { makeMockClients } from "../lib/mock/story";

const DATASET = "0xcmp0000000000000000000000000000000000005" as `0x${string}`;
const ALLOWED = ["sha256:mean-aggregate", "sha256:logistic-regression"];

test("allowed job → done, metrics, resultIpId, decrypt called, NO raw rows", async () => {
  const clients = makeMockClients("0xdeadbeef");
  const spy = vi.spyOn(clients.cdr.consumer, "downloadFile");

  const result = await runComputeJob({
    datasetIpId: DATASET,
    algoHash: "sha256:mean-aggregate",
    allowedAlgoHashes: ALLOWED,
    clients,
  });

  expect(result.status).toBe("done");
  expect(result.decryptCalled).toBe(true);
  expect(result.metrics).toBeTruthy();
  expect(result.resultIpId).toBeTruthy();
  expect(result.isolationMode).toContain("operator-trusted");
  // decryption must actually have been attempted inside the worker.
  expect(spy).toHaveBeenCalled();
  // RESULTS ONLY: raw rows must never appear anywhere in the output.
  const blob = JSON.stringify(result);
  expect(blob).not.toContain('"rows"');
  expect(blob).not.toContain('"values"');
});

test("off-allowlist job → rejected, decrypt NEVER invoked", async () => {
  const clients = makeMockClients("0xdeadbeef");
  const spy = vi.spyOn(clients.cdr.consumer, "downloadFile");

  const result = await runComputeJob({
    datasetIpId: DATASET,
    algoHash: "sha256:dump-all-rows",
    allowedAlgoHashes: ALLOWED,
    clients,
  });

  expect(result.status).toBe("rejected");
  expect(result.decryptCalled).toBe(false);
  expect(result.metrics).toBeUndefined();
  expect(result.resultIpId).toBeUndefined();
  // PROOF: the worker refused before touching the vault.
  expect(spy).not.toHaveBeenCalled();
});

test("plaintext scratch is wiped after a completed job", async () => {
  const clients = makeMockClients("0xdeadbeef");
  const result = await runComputeJob({
    datasetIpId: DATASET,
    algoHash: "sha256:logistic-regression",
    allowedAlgoHashes: ALLOWED,
    clients,
  });
  expect(result.status).toBe("done");
  expect(result.scratchCleared).toBe(true);
});

test("logistic-regression returns coefficients-only metrics (no rows)", async () => {
  const clients = makeMockClients("0xdeadbeef");
  const result = await runComputeJob({
    datasetIpId: DATASET,
    algoHash: "sha256:logistic-regression",
    allowedAlgoHashes: ALLOWED,
    clients,
  });
  expect(result.status).toBe("done");
  expect(result.metrics).toBeTruthy();
  expect("rows" in (result.metrics ?? {})).toBe(false);
  expect("values" in (result.metrics ?? {})).toBe(false);
});
