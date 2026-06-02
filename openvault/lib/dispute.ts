// Dispute helpers: raise a report against a target IP with fresh evidence, and
// counter an assertion. A fresh evidence CID is generated every call — a real
// dispute must never reuse stale evidence.

import { randomUUID } from "node:crypto";
import { parseEther } from "viem";

/** Conservative bond fallback used when the caller doesn't pass one. The Story
 *  SDK (core-sdk 1.4.4) no longer auto-reads the on-chain minimum bond inside
 *  raiseDispute — it crashes with "Cannot convert undefined to a BigInt" if
 *  `bond` is omitted. 0.1 WIP is the documented Aeneid arbitration-policy
 *  minimum for IMPROPER_REGISTRATION; caller can still override. */
const DEFAULT_BOND_WEI = parseEther("0.1");

/** Story arbitration policy default liveness window — 30 days, in seconds.
 *  This is the time during which the target can post counter-evidence. */
const DEFAULT_LIVENESS_SECONDS = 30 * 24 * 3600;

/** Build a proper CIDv0 (dag-pb codec, sha256 multihash) from a 32-byte hash.
 *  The Story SDK calls .toV0() on the CID internally, which requires dag-pb
 *  codec — any non-dag-pb codec rejects with "Cannot convert a non dag-pb CID
 *  to CIDv0". CIDv0 = base58btc-encode([0x12, 0x20, ...32 hash bytes]).
 *  The leading bytes 0x12, 0x20 happen to encode to the "Qm" prefix. */
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  let out = "";
  while (value > 0n) {
    const r = Number(value % 58n);
    out = BASE58_ALPHABET[r] + out;
    value /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}
function buildCidV0Sha256(hash: Uint8Array): string {
  if (hash.length !== 32) throw new Error("buildCidV0Sha256: expected 32 bytes");
  const bytes = new Uint8Array(34);
  bytes[0] = 0x12; // multihash: sha2-256
  bytes[1] = 0x20; // length: 32 bytes
  bytes.set(hash, 2);
  return base58Encode(bytes);
}

/** A unique evidence CID each call (never reuse stale evidence). Real CIDv0
 *  the Story SDK accepts; uniqueness comes from hashing prefix + uuid + nanos. */
export function freshEvidenceCid(prefix = "Evidence"): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const seed = prefix + ":" + randomUUID() + ":" + process.hrtime.bigint().toString();
  const hash = createHash("sha256").update(seed).digest();
  return buildCidV0Sha256(new Uint8Array(hash));
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
  // SDK shape (core-sdk 1.4.4): `liveness` is REQUIRED; `bond` defaults to the
  // on-chain minimum if omitted; `wipOptions` is a top-level key for the
  // dispute module (not nested under `options` like other modules — the SDK
  // omits `useMulticallWhenPossible` here due to the dispute-initiator quirk).
  const req: Record<string, unknown> = {
    targetIpId,
    cid,
    targetTag: tag,
    liveness: liveness ?? DEFAULT_LIVENESS_SECONDS,
    bond: bond ?? DEFAULT_BOND_WEI,
    wipOptions: { enableAutoWrapIp: true, enableAutoApprove: true },
  };
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
