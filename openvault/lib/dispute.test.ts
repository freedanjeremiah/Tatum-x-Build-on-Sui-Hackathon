import { test, expect } from "vitest";
import { makeMockClients } from "./mock/story";
import { freshEvidenceCid, raiseReport, counterDispute } from "./dispute";

test("freshEvidenceCid() returns a different value on two calls", () => {
  const a = freshEvidenceCid();
  const b = freshEvidenceCid();
  expect(a).not.toBe(b);
  expect(a.startsWith("bafy")).toBe(true);
});

test("raiseReport returns a disputeId and counterDispute returns a tx in mock", async () => {
  const { story } = makeMockClients("0xowner");
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
