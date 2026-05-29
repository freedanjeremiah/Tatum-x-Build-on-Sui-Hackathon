import { test, expect } from "vitest";
import { RUN_INTEGRATION, realClients } from "./itest";
import { freshEvidenceCid, raiseReport, counterDispute } from "./dispute";

const itInt = test.skipIf(!RUN_INTEGRATION);

test("freshEvidenceCid() returns a different value on two calls", () => {
  const a = freshEvidenceCid();
  const b = freshEvidenceCid();
  expect(a).not.toBe(b);
  expect(a.startsWith("bafy")).toBe(true);
});

itInt("raiseReport returns a disputeId and counterDispute returns a tx", async () => {
  const { story } = await realClients();
  const r = await raiseReport(story as any, {
    targetIpId: "0xtarget" as `0x${string}`,
    cid: freshEvidenceCid(),
    tag: "IMPROPER_REGISTRATION",
    bond: 1n,
    liveness: 2592000,
  });
  expect(r.disputeId).toBeDefined();
  const c = await counterDispute(story as any, {
    ipId: "0xtarget" as `0x${string}`,
    disputeId: r.disputeId,
    counterEvidenceCID: freshEvidenceCid(),
  });
  expect(c.txHash).toBeTruthy();
});
