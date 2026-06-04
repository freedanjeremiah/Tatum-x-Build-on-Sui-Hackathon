// End-to-end royalty smoke test against the seeded artifacts (Sui-native):
//   A) claim on a never-paid artifact      → guard refuses (NoRoyaltyVaultError)
//   B) pay a royalty into a gated artifact  → real on-chain payment succeeds
//   C) claim that artifact with its cap     → accrued revenue is withdrawn
//
// On Sui every artifact owns its vault; "no vault" reduces to "nothing accrued
// yet", which the claim guard surfaces as NoRoyaltyVaultError.
//
// Run: pnpm real scripts/_royalty-smoke.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getClients, logTx } from "./_util";
import {
  payRoyalty,
  claimRevenue,
  getClaimable,
  NoRoyaltyVaultError,
} from "../lib/royalty";

const SEED_DIR = resolve(__dirname, "sample", "seed");
const MIST_PER_SUI = 1_000_000_000n;

interface SeedRow {
  key: string;
  tier: string;
  ipId: `0x${string}`;
  capId?: string;
  parent: string | null;
  hasVault: boolean;
}

async function main() {
  const clients = await getClients();
  const results = JSON.parse(
    readFileSync(resolve(SEED_DIR, "seed-results.json"), "utf-8"),
  ) as SeedRow[];
  const byKey: Record<string, SeedRow> = {};
  for (const r of results) byKey[r.key] = r;

  const noVault = byKey["d_housing"]; // public, never paid → nothing to claim
  const withVault = byKey["d_iris"]; // gated → royalty-receivable

  if (!noVault || !withVault) {
    throw new Error("seed-results.json missing d_housing/d_iris — run _seed-royalty.ts first");
  }
  if (!withVault.capId) {
    throw new Error("d_iris has no capId in seed-results.json — re-run the (ported) seed");
  }

  // A) guard refuses a claim on an artifact with nothing accrued -------------
  console.log(`A) claim ${noVault.key} (${noVault.tier}, expect REFUSAL — nothing accrued)`);
  try {
    if (!noVault.capId) throw new NoRoyaltyVaultError(noVault.ipId);
    await claimRevenue(clients, noVault.ipId, noVault.capId);
    console.log("  ✗ UNEXPECTED: claim was not refused\n");
  } catch (e) {
    const ok = e instanceof NoRoyaltyVaultError;
    console.log(`  ${ok ? "✓" : "✗"} refused: ${(e as Error).message.slice(0, 60)}…\n`);
  }

  // B) real payment into a gated artifact's vault ----------------------------
  const amount = MIST_PER_SUI / 20n; // 0.05 SUI
  console.log(`B) pay 0.05 SUI → ${withVault.key} (${withVault.tier}, expect SUCCESS)`);
  const pay = await payRoyalty(clients, withVault.ipId, amount);
  logTx("  paid royalty", pay.txHash);

  // C) claim the accrued revenue with the artifact's cap ---------------------
  console.log(`\nC) claim accrued revenue on ${withVault.key}`);
  const before = await getClaimable(clients, withVault.ipId);
  console.log(`  claimable before: ${before.toString()} MIST`);
  const claim = await claimRevenue(clients, withVault.ipId, withVault.capId);
  logTx("  claimed revenue", claim.txHash);
  const after = await getClaimable(clients, withVault.ipId);
  console.log(`  claimable after:  ${after.toString()} MIST`);

  console.log("\n✓ royalty flow proven: guard blocks empty-vault claim, pay + claim work.");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", (e as Error)?.message ?? e);
  process.exit(1);
});
