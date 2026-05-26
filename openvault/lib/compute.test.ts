import { test, expect } from "vitest";
import { allowlistCheck, submitJob, runComputeJobInline } from "./compute";

const allowed = ["sha256:mean-aggregate", "sha256:logistic-regression"];

test("allowlistCheck rejects an unknown hash and accepts a listed one", () => {
  expect(allowlistCheck("sha256:dump-all-rows", allowed)).toBe(false);
  expect(allowlistCheck("sha256:mean-aggregate", allowed)).toBe(true);
});

test("submitJob builds a pending ComputeJob", () => {
  const job = submitJob({
    datasetIpId: "0xds" as `0x${string}`,
    consumer: "0xme" as `0x${string}`,
    algoHash: "sha256:mean-aggregate",
    computeLicenseTokenId: 1n,
  });
  expect(job.status).toBe("pending");
  expect(job.id).toBeTruthy();
  expect(job.datasetIpId).toBe("0xds");
});

test("runComputeJobInline rejects an off-allowlist algo WITHOUT decrypting", async () => {
  const result = await runComputeJobInline(
    {
      datasetIpId:
        "0xcmp0000000000000000000000000000000000005" as `0x${string}`,
      algoHash: "sha256:dump-all-rows",
    },
    allowed
  );
  expect(result.status).toBe("rejected");
  expect(result.decryptCalled).toBe(false);
  expect(result.metrics).toBeUndefined();
  expect(result.resultIpId).toBeUndefined();
});

test("runComputeJobInline returns metrics + a derivative resultIpId on a done run", async () => {
  const result = await runComputeJobInline(
    {
      datasetIpId:
        "0xcmp0000000000000000000000000000000000005" as `0x${string}`,
      algoHash: "sha256:mean-aggregate",
    },
    allowed
  );
  expect(result.status).toBe("done");
  expect(result.decryptCalled).toBe(true);
  expect(result.metrics).toBeTruthy();
  expect(typeof result.metrics?.mean).toBe("number");
  expect(result.resultIpId).toBeTruthy();
  expect(result.isolationMode).toContain("operator-trusted");
});
