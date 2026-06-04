// Dispute helpers — Sui-native (replaces the Story DisputeModule / arbitration
// oracle). On Sui a dispute is an on-chain flag + event in tessera::registry:
//
//   - `raiseReport` files evidence against a target artifact (Move `raise_dispute`):
//     sets the sticky `disputed` flag, bumps `dispute_count`, emits `Disputed`.
//   - `counterDispute` submits counter-evidence (Move `counter_dispute`), emitting
//     a `CounterEvidence` event. Resolution is an off-chain arbitration decision
//     (intentionally NOT modeled on-chain — the flag is forward-only).
//
// A fresh evidence CID is generated every call — a real dispute must never reuse
// stale evidence. `freshEvidenceCid` is chain-agnostic (node:crypto only).
//
// BONDS: the EVM path required a WIP bond posted to an optimistic oracle. This
// Sui model has NO on-chain bond — disputes are permissionless flags/events, and
// arbitration (slashing, refunds) is handled off-chain by a reviewer. Dropping
// the bond is documented here rather than faked with a magic SUI number.
//
// No viem, no @story-protocol, no removed EVM constants. Never logs secrets.

import { randomUUID } from "node:crypto";

import { RegistryClient } from "./registry";
import type { SuiClient, Signer } from "./clients";

/** Minimal write-capable client bundle (subset of Server/Browser Clients). */
export interface DisputeClients {
  client: SuiClient;
  signer: Signer;
}

// ---------------------------------------------------------------------------
// freshEvidenceCid — a unique CIDv0 (dag-pb + sha2-256) every call.
// Chain-agnostic: kept identical to the EVM path so existing UI / index shapes
// (which display a "Qm…" CID) are unchanged. The CID is an opaque pointer; on
// Sui it is stored as the UTF-8 bytes of the `Disputed`/`CounterEvidence` event.
// ---------------------------------------------------------------------------

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

/** A unique evidence CID each call (never reuse stale evidence). Real CIDv0,
 *  "Qm…" prefixed; uniqueness comes from hashing prefix + uuid + nanos. */
export function freshEvidenceCid(prefix = "Evidence"): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const seed = prefix + ":" + randomUUID() + ":" + process.hrtime.bigint().toString();
  const hash = createHash("sha256").update(seed).digest();
  return buildCidV0Sha256(new Uint8Array(hash));
}

// ---------------------------------------------------------------------------
// raiseReport — file a dispute against a target artifact.
// ---------------------------------------------------------------------------

export interface RaiseReportResult {
  /** Tx digest of the raise_dispute call (also the dispute reference). */
  txHash: string;
  /** The on-chain dispute count after this report (>= 1). */
  disputeCount: bigint;
  /** The evidence CID that was filed. */
  cid: string;
  /**
   * Back-compat dispute identifier for callers/UI that key off `disputeId`.
   * On Sui there is no numeric dispute id — the (artifactId, txHash) pair
   * identifies the report — so this is the tx digest.
   */
  disputeId: string;
}

/**
 * Raise a dispute (report) against `targetArtifactId` with `evidenceCid` and a
 * human `reason` (recorded by encoding "reason\ncid" into the on-chain evidence
 * bytes, so the `Disputed` event carries both). Permissionless. Returns the tx
 * digest + the new on-chain dispute count.
 */
export async function raiseReport(
  clients: DisputeClients,
  targetArtifactId: string,
  evidenceCid: string,
  reason: string,
): Promise<RaiseReportResult> {
  if (!evidenceCid || evidenceCid.trim() === "") {
    throw new Error("raiseReport: evidenceCid is required");
  }
  const reg = new RegistryClient(clients.client);
  const evidence = encodeEvidence(reason, evidenceCid);
  const txHash = await reg.raiseDispute(targetArtifactId, evidence, clients.signer);
  // Read back the authoritative count from chain (no optimistic local guess).
  const disputeCount = (await reg.getArtifact(targetArtifactId)).disputeCount;
  return { txHash, disputeCount, cid: evidenceCid, disputeId: txHash };
}

// ---------------------------------------------------------------------------
// counterDispute — submit counter-evidence against a raised dispute.
// ---------------------------------------------------------------------------

export interface CounterDisputeResult {
  txHash: string;
  /** The counter-evidence CID that was filed. */
  cid: string;
}

/**
 * Submit counter-evidence (`counterEvidenceCid`) against a dispute on
 * `artifactId`. Permissionless (typically the owner). Emits a `CounterEvidence`
 * event; does not clear the `disputed` flag (off-chain resolution). Returns the
 * tx digest.
 */
export async function counterDispute(
  clients: DisputeClients,
  artifactId: string,
  counterEvidenceCid: string,
): Promise<CounterDisputeResult> {
  if (!counterEvidenceCid || counterEvidenceCid.trim() === "") {
    throw new Error("counterDispute: counterEvidenceCid is required");
  }
  const reg = new RegistryClient(clients.client);
  const evidence = encodeEvidence("Counter", counterEvidenceCid);
  const txHash = await reg.counterDispute(artifactId, evidence, clients.signer);
  return { txHash, cid: counterEvidenceCid };
}

/** Encode "reason\ncid" into UTF-8 bytes for the on-chain evidence pointer. */
function encodeEvidence(reason: string, cid: string): Uint8Array {
  const text = reason && reason.trim() !== "" ? `${reason}\n${cid}` : cid;
  return new TextEncoder().encode(text);
}
