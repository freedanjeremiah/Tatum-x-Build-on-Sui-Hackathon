// SPEC §8.7 — Group bundle (Sui-native).
//
// Create a shared Group object, record member artifacts at creation, add one
// more, then realize group revenue by claiming each member's own on-chain
// royalty vault (Sui has no shared even-split pool — see lib/group.ts). Each
// member carries its own ArtifactCap, captured at register time so `distribute`
// can owner-claim per member.
//
// Run: pnpm real scripts/05-group.ts

import type { ServerClients } from "../lib/clients";
import { getClients, logTx } from "./_util";
import { uploadPublic } from "../lib/artifacts";
import { createGroup, addToGroup, distribute } from "../lib/group";

interface Member {
  artifactId: string;
  capId: string;
}

async function registerMember(clients: ServerClients, title: string): Promise<Member> {
  const owner = clients.account.address as `0x${string}`;
  const art = await uploadPublic(clients, {
    bytes: new TextEncoder().encode(title),
    meta: {
      title,
      description: `Group member ${title}.`,
      tags: ["group", "member"],
      creators: [{ name: "Reef Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });
  return { artifactId: art.ipId, capId: art.capId! };
}

async function main() {
  const clients = await getClients();

  // Three member artifacts (A, B recorded at creation; C added after).
  const A = await registerMember(clients, "Member A");
  const B = await registerMember(clients, "Member B");
  const C = await registerMember(clients, "Member C");

  const grp = await createGroup(clients, [A.artifactId, B.artifactId]);
  const groupId = grp.groupId;
  logTx("create group", grp.txHash);

  const add = await addToGroup(clients, grp.capId, groupId, [C.artifactId]);
  logTx("add member C", add.txHash);

  // Realize revenue: claim each member's own vault (skips empty vaults).
  const dist = await distribute(clients, [A, B, C]);

  console.log("=== 05-group (SPEC §8.7) ===");
  console.log("groupId:", groupId);
  console.log("members:", [A.artifactId, B.artifactId, C.artifactId]);
  console.log("total claimed (MIST):", dist.totalClaimed.toString());
  for (const r of dist.results) {
    console.log(`  ${r.artifactId}: ${r.skipped ? `skipped (${r.skipped})` : `claimed ${r.claimed} MIST`}`);
  }
  console.log("✓ group created, members recorded, member vaults distributed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
