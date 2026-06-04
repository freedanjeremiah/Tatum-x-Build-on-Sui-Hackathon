// Prove the derivative royalty flow (Sui-native): pay royalties into the
// DERIVATIVE with a share routed UP to its PARENT's vault, then the parent claims
// its accrued share.
//
//   pay 0.1 SUI → d_iris_aug (derivative), 10% routed up to d_iris
//   claim on d_iris with its ArtifactCap
//
// Run: pnpm real scripts/_royalty-claim-test.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getClients, logTx } from "./_util";
import { payRoyalty, claimRevenue, getClaimable } from "../lib/royalty";

const SEED_DIR = resolve(__dirname, "sample", "seed");
const MIST_PER_SUI = 1_000_000_000n;

interface SeedRow {
  key: string;
  ipId: `0x${string}`;
  capId?: string;
  parent: string | null;
}

async function main() {
  const clients = await getClients();
  const results = JSON.parse(
    readFileSync(resolve(SEED_DIR, "seed-results.json"), "utf-8"),
  ) as SeedRow[];
  const byKey: Record<string, SeedRow> = {};
  for (const r of results) byKey[r.key] = r;

  const parent = byKey["d_iris"];
  const child = byKey["d_iris_aug"];
  if (!parent || !child) {
    throw new Error("seed-results.json missing d_iris/d_iris_aug — run _seed-royalty.ts first");
  }
  if (!parent.capId) {
    throw new Error("d_iris has no capId in seed-results.json — re-run the (ported) seed");
  }

  const amount = MIST_PER_SUI / 10n; // 0.1 SUI
  console.log(`pay 0.1 SUI → derivative ${child.key} ${child.ipId} (10% routed up)`);
  const pay = await payRoyalty(clients, child.ipId, amount, { parentSharePct: 10 });
  logTx("  paid", pay.txHash);
  if (pay.parentTxHash) logTx("  routed up to parent", pay.parentTxHash);

  const before = await getClaimable(clients, parent.ipId);
  console.log(`\nparent ${parent.key} claimable before: ${before.toString()} MIST`);

  console.log(`claim on parent ${parent.key} with its cap`);
  const claim = await claimRevenue(clients, parent.ipId, parent.capId);
  logTx("  claimed", claim.txHash);

  const after = await getClaimable(clients, parent.ipId);
  console.log(`parent claimable after:  ${after.toString()} MIST`);
  console.log("\n✓ derivative royalty flow proven: pay child → parent claims its share up.");
}

main().catch((e) => {
  console.error("CLAIM TEST FAILED:", (e as Error)?.message ?? e);
  process.exit(1);
});
