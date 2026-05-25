// SPEC §8.5 — Derivative registration + royalty flow.
//
// Register a parent IP, register a derivative of it, pay royalties to the
// derivative, then confirm the parent has claimable revenue and claim it. The
// royalty steps now use lib/royalty; registration uses lib/artifacts.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/03-derivative-royalty.ts

import { getClients, logTx } from "./_util";
import { uploadGated, registerDerivative } from "../lib/artifacts";
import { payRoyalty, claimRevenue, getClaimable } from "../lib/royalty";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  // --- Parent IP (commercial-remix so a derivative can attach) ---
  const parent = await uploadGated(clients as any, {
    bytes: new TextEncoder().encode("base model weights"),
    meta: {
      title: "BaseModel-7B",
      description: "Commercial-remix base model.",
      tags: ["model", "base"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });
  const PARENT = parent.ipId;
  const PARENT_TERMS = parent.licenseTermsId!;
  logTx("register parent", parent.createdTx);

  // --- Derivative IP of the parent ---
  const child = await registerDerivative(clients as any, {
    parentIpId: PARENT,
    parentTermsId: PARENT_TERMS,
    bytes: new TextEncoder().encode("finetuned weights"),
    meta: {
      title: "BaseModel-7B-Finetuned",
      description: "A fine-tune derived from BaseModel-7B.",
      tags: ["model", "finetune"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });
  const CHILD = child.ipId;
  logTx("register derivative", child.createdTx);

  // --- Pay royalties on behalf of the derivative ---
  const pay = await payRoyalty(clients.story as any, { childIpId: CHILD, amount: 2n });
  logTx("pay royalty", pay.txHash);

  // --- Parent's claimable revenue must be > 0 ---
  const claimable = await getClaimable(clients.story as any, { ipId: PARENT });
  if (!(claimable > 0n)) throw new Error("expected parent claimable revenue > 0");

  // --- Claim all revenue flowing up from the child ---
  const claim = await claimRevenue(clients.story as any, {
    parentIpId: PARENT,
    childIpIds: [CHILD],
  });

  console.log("=== 03-derivative-royalty (SPEC §8.5) ===");
  console.log("parent ipId:", PARENT);
  console.log("child ipId:", CHILD);
  console.log("claimable revenue (wei):", claimable.toString());
  logTx("claim revenue", claim.txHash);
  console.log("✓ derivative registered, royalties paid + claimed by parent");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
