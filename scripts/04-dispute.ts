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
  const owner = clients.account.address as `0x${string}`;

  // A target artifact to dispute (register one so the script is self-contained).
  const target = await uploadPublic(clients, {
    bytes: new TextEncoder().encode("disputable artifact"),
    meta: {
      title: "Disputable Artifact",
      description: "Target of a demo dispute.",
      tags: ["demo"],
      creators: [{ name: "Tessera Demo", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
  });
  const targetIpId = target.ipId;

  // No on-chain bond on Sui: disputes are permissionless flags + events; the
  // reason/CID are recorded in the on-chain `Disputed` event (arbitration is
  // off-chain). See lib/dispute.ts for the documented bond drop.
  const reason = "IMPROPER_REGISTRATION";

  const evidenceCID = freshEvidenceCid("Evidence");
  const raised = await raiseReport(clients, targetIpId, evidenceCID, reason);
  logTx("raise dispute", raised.txHash);

  // Counter the report with fresh counter-evidence.
  const counterCID = freshEvidenceCid("Counter");
  const counter = await counterDispute(clients, targetIpId, counterCID);

  console.log("=== 04-dispute (SPEC §8.6) ===");
  console.log("targetArtifactId:", targetIpId);
  console.log("disputeId (tx digest):", raised.disputeId);
  console.log("disputeCount:", raised.disputeCount.toString());
  console.log("evidenceCID:", evidenceCID);
  console.log("counterEvidenceCID:", counter.cid);
  logTx("counter dispute", counter.txHash);
  console.log("✓ dispute raised + countered (fresh evidence each side)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
