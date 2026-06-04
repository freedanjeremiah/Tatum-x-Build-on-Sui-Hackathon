import { test, expect, vi } from "vitest";
import { freshEvidenceCid, raiseReport, counterDispute } from "./dispute";

test("freshEvidenceCid() returns a different value on two calls", () => {
  const a = freshEvidenceCid();
  const b = freshEvidenceCid();
  expect(a).not.toBe(b);
  // CIDv0 (dag-pb + sha2-256) — "Qm…" prefixed, chain-agnostic.
  expect(a.startsWith("Qm")).toBe(true);
  expect(a.length).toBeGreaterThan(40);
});

// A fake SuiClient whose tx succeeds and whose getObject reports the post-report
// dispute count so raiseReport can read it back.
function fakeClient(disputeCount = 1) {
  let n = 0;
  const core = {
    getObject: vi.fn(async () => ({
      object: {
        json: {
          owner: "0xowner",
          tier: 2,
          price: "0",
          group_id: null,
          parent: null,
          license_holders: { fields: { contents: [] } },
          compute_workers: { fields: { contents: [] } },
          revoked: { fields: { contents: [] } },
          revenue: "0",
          dispute_count: String(disputeCount),
          disputed: disputeCount > 0,
        },
      },
    })),
    signAndExecuteTransaction: vi.fn(async () => ({
      $kind: "Transaction",
      Transaction: {
        digest: `0xdig${n++}`,
        effects: { status: { success: true }, changedObjects: [] },
        objectTypes: {},
      },
    })),
    waitForTransaction: vi.fn(async () => ({})),
  };
  return { core } as any;
}

const signer = {} as any;

test("raiseReport files evidence and reads back the dispute count", async () => {
  const client = fakeClient(1);
  const out = await raiseReport(
    { client, signer },
    "0xtarget",
    freshEvidenceCid(),
    "improper registration",
  );
  expect(out.txHash).toBeTruthy();
  expect(out.disputeId).toBe(out.txHash); // tx digest is the dispute reference
  expect(out.disputeCount).toBe(1n);
  expect(client.core.signAndExecuteTransaction).toHaveBeenCalledOnce();
});

test("raiseReport rejects an empty evidence CID", async () => {
  const client = fakeClient();
  await expect(
    raiseReport({ client, signer }, "0xtarget", "", "reason"),
  ).rejects.toThrow();
});

test("counterDispute submits counter-evidence and returns a tx", async () => {
  const client = fakeClient();
  const out = await counterDispute({ client, signer }, "0xtarget", freshEvidenceCid("Counter"));
  expect(out.txHash).toBeTruthy();
  expect(out.cid).toBeTruthy();
  expect(client.core.signAndExecuteTransaction).toHaveBeenCalledOnce();
});
