// Seed the compute-tier artifacts' royalty vaults (Sui-native). Every artifact
// already owns its vault (`revenue: Balance<SUI>`), so there is nothing to deploy
// — instead we pay a small royalty into each compute artifact so its vault is
// demonstrably accruing (and claimable). No re-registration.
//
// Run: pnpm real scripts/_deploy-compute-vaults.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getClients, logTx } from "./_util";
import { payRoyalty, getClaimable } from "../lib/royalty";

const SEED_DIR = resolve(__dirname, "sample", "seed");
const MIST_PER_SUI = 1_000_000_000n;

interface SeedRow {
  key: string;
  tier: string;
  ipId: `0x${string}`;
  capId?: string;
}

function suiToMist(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(9)).slice(0, 9);
  return BigInt(whole) * MIST_PER_SUI + BigInt(fracPadded || "0");
}

interface ManifestEntry {
  key: string;
  tier: string;
  terms: { fee: string } | null;
}

async function main() {
  const clients = await getClients();

  const manifest = JSON.parse(
    readFileSync(resolve(SEED_DIR, "seed-manifest.json"), "utf-8"),
  ) as ManifestEntry[];
  const results = JSON.parse(
    readFileSync(resolve(SEED_DIR, "seed-results.json"), "utf-8"),
  ) as SeedRow[];
  const rowByKey: Record<string, SeedRow> = {};
  for (const r of results) rowByKey[r.key] = r;

  const computeEntries = manifest.filter((e) => e.tier === "compute");
  console.log(`seeding vaults for ${computeEntries.length} compute artifacts\n`);

  for (const e of computeEntries) {
    const row = rowByKey[e.key];
    if (!row) {
      console.warn(`${e.key}: no artifactId in results — skip`);
      continue;
    }
    const fee = e.terms ? suiToMist(e.terms.fee) : MIST_PER_SUI / 100n;
    console.log(`→ ${e.key} ${row.ipId} seeding ${fee} MIST`);
    try {
      const pay = await payRoyalty(clients, row.ipId, fee);
      logTx("  paid", pay.txHash);
      const claimable = await getClaimable(clients, row.ipId);
      console.log(`  vault accrued: ${claimable.toString()} MIST\n`);
    } catch (err) {
      console.error(`  ✗ ${(err as Error)?.message ?? err}\n`);
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", (e as Error)?.message ?? e);
  process.exit(1);
});
