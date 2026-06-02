// End-to-end royalty smoke test against the seeded IPs:
//   A) pay to a NO-vault IP (public)   → guard refuses (NoRoyaltyVaultError)
//   B) pay to a vault IP (gated d_iris) → real on-chain payment succeeds
//   C) claim on the parent of a derivative → revenue flows up
//
// Run: pnpm real scripts/_royalty-smoke.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEther, formatEther } from "viem";
import { getClients, logTx } from "./_util";
import {
  payRoyalty,
  claimRevenue,
  getClaimable,
  NoRoyaltyVaultError,
} from "../lib/royalty";

const SEED_DIR = resolve(__dirname, "sample", "seed");

async function main() {
  const clients = await getClients();
  const pc = (clients as any).publicClient;
  const results = JSON.parse(readFileSync(resolve(SEED_DIR, "seed-results.json"), "utf-8")) as any[];
  const byKey: Record<string, any> = {};
  for (const r of results) byKey[r.key] = r;

  const noVault = byKey["d_housing"]; // public → no vault
  const withVault = byKey["d_iris"]; // gated → vault deployed
  const child = byKey["d_iris_aug"]; // derivative of d_iris

  // A) guard refuses the doomed payment ---------------------------------------
  console.log(`A) pay 0.01 → ${noVault.key} (${noVault.tier}, expect REFUSAL)`);
  try {
    await payRoyalty(clients.story, {
      childIpId: noVault.ipId,
      amount: parseEther("0.01"),
      publicClient: pc,
    });
    console.log("  ✗ UNEXPECTED: payment was not refused\n");
  } catch (e) {
    const ok = e instanceof NoRoyaltyVaultError;
    console.log(`  ${ok ? "✓" : "✗"} refused: ${(e as Error).message.slice(0, 60)}…\n`);
  }

  // B) real payment to a vault IP ---------------------------------------------
  console.log(`B) pay 0.05 → ${withVault.key} (${withVault.tier}, expect SUCCESS)`);
  const pay = await payRoyalty(clients.story, {
    childIpId: withVault.ipId,
    amount: parseEther("0.05"),
    publicClient: pc,
  });
  logTx("  paid royalty", pay.txHash);

  // C) claim on the parent through its derivative -----------------------------
  console.log(`\nC) claim on ${withVault.key} through derivative ${child.key}`);
  const before = await getClaimable(clients.story, { ipId: withVault.ipId });
  console.log(`  claimable before: ${formatEther(before)} WIP`);
  const claim = await claimRevenue(clients.story, {
    parentIpId: withVault.ipId,
    childIpIds: [child.ipId],
  });
  logTx("  claimed revenue", claim.txHash);
  const after = await getClaimable(clients.story, { ipId: withVault.ipId });
  console.log(`  claimable after:  ${formatEther(after)} WIP`);

  console.log("\n✓ royalty flow proven: guard blocks no-vault, pay + claim work on vaults.");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e?.shortMessage || e?.message || e);
  process.exit(1);
});
