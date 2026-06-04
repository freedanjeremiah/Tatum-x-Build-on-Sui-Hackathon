import { describe, it, expect, vi, beforeEach } from "vitest";
import { callEnclave, ENCLAVE_URL_ENV } from "./enclaveClient";

describe("callEnclave", () => {
  beforeEach(() => { process.env[ENCLAVE_URL_ENV] = "https://enc.local"; });

  it("returns the signed payload from process_data", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      response: { intent: 0, timestamp_ms: 1717000000000, data: { metrics: { n: 5 } } },
      signature: "00".repeat(64),
    }), { status: 200 })) as any;
    const out = await callEnclave({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" });
    expect(out.metrics).toEqual({ n: 5 });
    expect(out.timestampMs).toBe(1717000000000n);
    expect(out.signature).toHaveLength(64);
  });

  it("throws (no silent fallback) when the enclave is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("ECONNREFUSED"); }) as any;
    await expect(callEnclave({ datasetIpId: "0x1", algoHash: "x" })).rejects.toThrow(/enclave/i);
  });
});
