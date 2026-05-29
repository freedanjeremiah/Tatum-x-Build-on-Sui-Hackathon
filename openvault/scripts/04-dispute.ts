// SPEC §8.6 — Dispute raise + counter.
//
// Raise a dispute against a target IP with fresh evidence, then have the target
// owner counter the assertion with fresh counter-evidence. The dispute steps now
// use lib/dispute (fresh evidence CID per call).
//
// Run: pnpm real scripts/04-dispute.ts

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

  // Bond + liveness omitted: the SDK reads OptimisticOracleV3.getMinimumBond(WIP)
  // and the arbitration policy's min liveness from chain, then auto-wraps the
  // bond from native IP via WIP_OPTIONS (spread in raiseReport).
  const tag = "IMPROPER_REGISTRATION";

  const evidenceCID = freshEvidenceCid("Evidence");
  const raised = await raiseReport(clients.story as any, {
    targetIpId,
    cid: evidenceCID,
    tag,
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
  console.log("bond: (on-chain minimum from arbitration policy)");
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
