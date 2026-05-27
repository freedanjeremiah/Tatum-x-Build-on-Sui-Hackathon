// SPEC §8.6 — Dispute raise + counter.
//
// Raise a dispute against a target IP with fresh evidence, then have the target
// owner counter the assertion with fresh counter-evidence. The dispute steps now
// use lib/dispute (fresh evidence CID per call).
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/04-dispute.ts

import { parseEther } from "viem";

import { getClients, logTx } from "./_util";
import { uploadPublic } from "../lib/artifacts";
import { freshEvidenceCid, raiseReport, counterDispute } from "../lib/dispute";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  // A target IP to dispute (register one so the script is self-contained).
  const target = await uploadPublic(clients as any, {
    bytes: new TextEncoder().encode("disputable artifact"),
    meta: {
      title: "Disputable Artifact",
      description: "Target of a demo dispute.",
      tags: ["demo"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
  });
  const targetIpId = target.ipId;

  // Minimum bond. VERIFY: real mode reads OptimisticOracleV3.getMinimumBond(WIP);
  // 0.1 IP is a safe default fallback that the dispute module accepts.
  const bond = parseEther("0.1");
  // DisputeTargetTag.IMPROPER_REGISTRATION === the string "IMPROPER_REGISTRATION"
  // (confirmed in core-sdk dispute.d.ts), so this literal is the enum value.
  const tag = "IMPROPER_REGISTRATION";

  const evidenceCID = freshEvidenceCid("Evidence");
  const raised = await raiseReport(clients.story as any, {
    targetIpId,
    cid: evidenceCID,
    tag,
    bond,
    liveness: 2592000, // 30 days
  });
  logTx("raise dispute", raised.txHash);

  // Counter the assertion with fresh counter-evidence.
  const counterCID = freshEvidenceCid("Counter");
  const counter = await counterDispute(clients.story as any, {
    ipId: targetIpId,
    disputeId: raised.disputeId,
    counterEvidenceCID: counterCID,
  });

  console.log("=== 04-dispute (SPEC §8.6) ===");
  console.log("targetIpId:", targetIpId);
  console.log("disputeId:", raised.disputeId);
  console.log("bond (wei):", bond.toString());
  console.log("evidenceCID:", evidenceCID);
  console.log("assertionId:", counter.assertionId);
  console.log("counterEvidenceCID:", counterCID);
  logTx("counter assertion", counter.txHash);
  console.log("✓ dispute raised + countered (fresh evidence each side)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
