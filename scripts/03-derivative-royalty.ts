// SPEC §8.5 — Derivative registration + royalty flow (Sui-native).
//
// Register a parent artifact, register a derivative of it, pay royalties into the
// derivative's on-chain vault with a share routed UP to the parent (Sui has each
// artifact carry its own `revenue: Balance<SUI>`), then confirm the parent has
// claimable revenue and claim it with the parent's ArtifactCap.
//
// Run: pnpm real scripts/03-derivative-royalty.ts

import { getClients, logTx, selfIndex } from "./_util";
import { uploadGated, registerDerivative } from "../lib/artifacts";
import { payRoyalty, claimRevenue, getClaimable } from "../lib/royalty";

async function main() {
  const clients = await getClients();
  const owner = clients.account.address as `0x${string}`;

  // --- Parent artifact (gated so a license/royalty flow makes sense) ---
  const parent = await uploadGated(clients, {
    bytes: new TextEncoder().encode("base model weights"),
    meta: {
      title: "BaseModel-7B",
      description: "Commercial-remix base model.",
      tags: ["model", "base"],
      creators: [{ name: "Reef Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
    // Explicit terms — no silent default.
    terms: { rev: 5, fee: 1n },
  });
  const PARENT = parent.ipId;
  const PARENT_CAP = parent.capId!;
  logTx("register parent", parent.createdTx);
  await selfIndex(parent as unknown as Record<string, unknown>);

  // --- Derivative artifact of the parent (lineage → royalties flow upstream) ---
  const child = await registerDerivative(clients, {
    parentIpId: PARENT,
    bytes: new TextEncoder().encode("finetuned weights"),
    meta: {
      title: "BaseModel-7B-Finetuned",
      description: "A fine-tune derived from BaseModel-7B.",
      tags: ["model", "finetune"],
      creators: [{ name: "Reef Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });
  const CHILD = child.ipId;
  logTx("register derivative", child.createdTx);
  await selfIndex(child as unknown as Record<string, unknown>);

  // --- Pay royalties into the child's vault, splitting 100% up to the parent ---
  // (the child has a `parent` lineage, so the whole amount routes to the parent's
  // vault and the parent ends up with claimable revenue).
  const pay = await payRoyalty(clients, CHILD, 2n, { parentSharePct: 100 });
  if (pay.parentTxHash) logTx("pay royalty → parent", pay.parentTxHash);
  else logTx("pay royalty", pay.txHash);

  // --- Parent's claimable revenue must be > 0 ---
  const claimable = await getClaimable(clients, PARENT);
  if (!(claimable > 0n)) throw new Error("expected parent claimable revenue > 0");

  // --- Claim all revenue accrued in the parent's vault ---
  const claim = await claimRevenue(clients, PARENT, PARENT_CAP);

  console.log("=== 03-derivative-royalty (SPEC §8.5) ===");
  console.log("parent artifactId:", PARENT);
  console.log("child artifactId:", CHILD);
  console.log("claimable revenue (MIST):", claimable.toString());
  logTx("claim revenue", claim.txHash);
  console.log("✓ derivative registered, royalties paid up + claimed by parent");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
