import { test, expect } from "vitest";
import { allowlistCheck, submitJob } from "./compute";

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
