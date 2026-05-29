// Dispute helpers: raise a report against a target IP with fresh evidence, and
// counter an assertion. A fresh evidence CID is generated every call — a real
// dispute must never reuse stale evidence.

import { randomUUID } from "node:crypto";
import { WIP_OPTIONS } from "./constants";

/** A unique evidence CID each call (never reuse stale evidence). */
export function freshEvidenceCid(prefix = "Evidence"): string {
  return "bafy" + prefix + randomUUID().replace(/-/g, "");
}

/**
 * Raise a dispute report against a target IP. If `bond` is omitted, the SDK
 * reads OptimisticOracleV3.getMinimumBond(WIP) on-chain and uses that — the
 * source of truth, never a hardcoded magic number. `liveness` defaults to the
 * arbitration policy's minimum if omitted (handled by the SDK).
 *
 * WIP_OPTIONS is spread so the SDK auto-wraps the bond from native IP and
 * auto-approves the dispute module in the same multicall — caller never has to
 * pre-wrap WIP.
 */
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
    /** Omit to use the on-chain minimum bond. */
    bond?: bigint;
    /** Omit to use the arbitration policy's min liveness. */
    liveness?: number;
  }
): Promise<{ disputeId: any; txHash: `0x${string}` }> {
  const req: Record<string, unknown> = {
    targetIpId,
    cid,
    targetTag: tag,
    ...WIP_OPTIONS,
  };
  if (bond !== undefined) req.bond = bond;
  if (liveness !== undefined) req.liveness = liveness;
  const raised = await story.dispute.raiseDispute(req);
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
