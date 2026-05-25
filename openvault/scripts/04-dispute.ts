// SPEC §8.6 — Dispute raise + counter.
//
// Raise a dispute against a target IP with fresh evidence, then have the target
// owner counter the assertion with fresh counter-evidence.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/04-dispute.ts

import { randomUUID } from "node:crypto";
import { parseEther } from "viem";

import { getClients, logTx } from "./_util";
import { IS_MOCK } from "../lib/env";
import { PUBLIC_SPG_COLLECTION } from "../lib/constants";

// Fresh evidence CID every run (a real dispute must not reuse stale evidence).
const freshCid = (prefix: string) => "bafy" + prefix + randomUUID().replace(/-/g, "");

async function main() {
  const { story } = await getClients();

  // A target IP to dispute (register one so the script is self-contained).
  const target = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: { commercialUse: false, attribution: true } }],
    ipMetadata: {},
  } as any);
  const targetIpId = (target as any).ipId as `0x${string}`;

  // Minimum bond.
  // VERIFY: real mode reads OptimisticOracleV3.getMinimumBond(WIP) on-chain.
  const bond = IS_MOCK ? parseEther("0.1") : parseEther("0.1"); // fallback if read fails

  // DisputeTargetTag. Real mode: import { DisputeTargetTag } from core-sdk.
  // VERIFY: DisputeTargetTag.IMPROPER_REGISTRATION enum from "@story-protocol/core-sdk"
  const targetTag = "IMPROPER_REGISTRATION";

  const evidenceCID = freshCid("Evidence");
  const raised = await story.dispute.raiseDispute({
    targetIpId,
    cid: evidenceCID,
    targetTag,
    bond,
    liveness: 2592000, // 30 days
  } as any);
  const disputeId = (raised as any).disputeId;
  logTx("raise dispute", (raised as any).txHash);

  // Counter the assertion with fresh counter-evidence.
  const assertionId = await story.dispute.disputeIdToAssertionId(Number(disputeId));
  const counterCID = freshCid("Counter");
  const counter = await story.dispute.disputeAssertion({
    ipId: targetIpId,
    assertionId,
    counterEvidenceCID: counterCID,
  } as any);

  console.log("=== 04-dispute (SPEC §8.6) ===");
  console.log("targetIpId:", targetIpId);
  console.log("disputeId:", disputeId);
  console.log("bond (wei):", bond.toString());
  console.log("evidenceCID:", evidenceCID);
  console.log("assertionId:", assertionId);
  console.log("counterEvidenceCID:", counterCID);
  logTx("counter assertion", (counter as any).txHash);
  console.log("✓ dispute raised + countered (fresh evidence each side)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
