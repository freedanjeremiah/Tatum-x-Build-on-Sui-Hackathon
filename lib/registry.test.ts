import { describe, it, expect, vi } from "vitest";
import { RegistryClient } from "./registry";

describe("registerDerivativeAttested", () => {
  it("calls register_derivative_attested with the enclave object + signature", async () => {
    let capturedTarget: string | undefined;
    const fakeClient: any = {
      core: {
        signAndExecuteTransaction: vi.fn(async ({ transaction }) => {
          // Capture the moveCall target from the transaction's block data
          const data = transaction.getData?.() ?? (transaction as any).blockData;
          const json = JSON.stringify(data);
          // Store for assertion after the call resolves
          if (json.includes("register_derivative_attested")) {
            capturedTarget = "register_derivative_attested";
          }
          return {
            $kind: "Transaction",
            Transaction: {
              digest: "0xdig",
              effects: { status: { success: true }, changedObjects: [] },
              objectTypes: {},
            },
          };
        }),
        waitForTransaction: vi.fn(async () => ({})),
      },
    };
    const rc = new RegistryClient(fakeClient, "0x123");
    const digest = await rc.registerDerivativeAttested(
      {
        tier: "public",
        parentId: "0x" + "aa".repeat(32),
        enclaveObjectId: "0x" + "bb".repeat(32),
        timestampMs: 1717000000000n,
        algoHash: "sha256:mean-aggregate",
        metrics: new Uint8Array([1, 2, 3]),
        signature: new Uint8Array(64).fill(9),
      },
      {} as any,
    );
    expect(digest).toBe("0xdig");
    expect(capturedTarget).toBe("register_derivative_attested");
  });
});
