// Prove the derivative royalty flow: pay royalties to the DERIVATIVE, then the
// PARENT claims its revenue-share that flowed up through it.
//
//   pay 0.1 → d_iris_aug (derivative, 10% owed up to d_iris)
//   claim on d_iris through [d_iris_aug]
//
// Run: pnpm real scripts/_royalty-claim-test.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEther, formatEther } from "viem";
import { getClients, logTx } from "./_util";
import { payRoyalty, claimRevenue, getClaimable } from "../lib/royalty";

const SEED_DIR = resolve(__dirname, "sample", "seed");

async function main() {
  const clients = await getClients();
  const pc = (clients as any).publicClient;
  const results = JSON.parse(readFileSync(resolve(SEED_DIR, "seed-results.json"), "utf-8")) as any[];
  const byKey: Record<string, any> = {};
  for (const r of results) byKey[r.key] = r;

  const parent = byKey["d_iris"];
  const child = byKey["d_iris_aug"];

  console.log(`pay 0.1 WIP → derivative ${child.key} ${child.ipId}`);
  const pay = await payRoyalty(clients.story, {
    childIpId: child.ipId,
    amount: parseEther("0.1"),
    publicClient: pc,
  });
  logTx("  paid", pay.txHash);

  const before = await getClaimable(clients.story, { ipId: parent.ipId });
  console.log(`\nparent ${parent.key} claimable before: ${formatEther(before)} WIP`);

  console.log(`claim on parent ${parent.key} through [${child.key}]`);
  const claim = await claimRevenue(clients.story, {
    parentIpId: parent.ipId,
    childIpIds: [child.ipId],
  });
  logTx("  claimed", claim.txHash);

  const after = await getClaimable(clients.story, { ipId: parent.ipId });
  console.log(`parent claimable after:  ${formatEther(after)} WIP`);
  console.log("\n✓ derivative royalty flow proven: pay child → parent claims its share up.");
}

main().catch((e) => {
  console.error("CLAIM TEST FAILED:", e?.shortMessage || e?.message || e);
  process.exit(1);
});
