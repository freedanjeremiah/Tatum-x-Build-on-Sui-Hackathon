// Dispute helpers: raise a report against a target IP with fresh evidence, and
// counter an assertion. A fresh evidence CID is generated every call — a real
// dispute must never reuse stale evidence.

import { randomUUID } from "node:crypto";

/** A unique evidence CID each call (never reuse stale evidence). */
export function freshEvidenceCid(prefix = "Evidence"): string {
  return "bafy" + prefix + randomUUID().replace(/-/g, "");
}

/** Raise a dispute report against a target IP. */
export async function raiseReport(
  story: any,
  {
    targetIpId,
    cid,
    tag,
    bond,
    liveness,
  }: {
    targetIpId: `0x${string}`;
    cid: string;
    tag: string;
    bond: bigint;
    liveness: number;
  }
): Promise<{ disputeId: any; txHash: `0x${string}` }> {
  const raised = await story.dispute.raiseDispute({
    targetIpId,
    cid,
    targetTag: tag,
    bond,
    liveness,
  });
  return { disputeId: raised.disputeId, txHash: raised.txHash };
}

/** Counter a dispute assertion with fresh counter-evidence. */
export async function counterDispute(
  story: any,
  {
    ipId,
    disputeId,
    counterEvidenceCID,
  }: { ipId: `0x${string}`; disputeId: any; counterEvidenceCID: string }
): Promise<{ assertionId: `0x${string}`; txHash: `0x${string}` }> {
  const assertionId = (await story.dispute.disputeIdToAssertionId(
    Number(disputeId)
  )) as `0x${string}`;
  const counter = await story.dispute.disputeAssertion({
    ipId,
    assertionId,
    counterEvidenceCID,
  });
  return { assertionId, txHash: counter.txHash };
}
