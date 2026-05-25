// SPEC §8.7 — Group bundle.
//
// Register a group with even-split rewards, attach a license, add member IPs,
// add one more, then collect + distribute group royalties to the members. The
// group steps now use lib/group.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/05-group.ts

import { getClients, logTx } from "./_util";
import { uploadPublic } from "../lib/artifacts";
import { createGroup, addToGroup, distribute } from "../lib/group";

async function registerMember(clients: any, title: string): Promise<`0x${string}`> {
  const owner = clients.account.address as `0x${string}`;
  const art = await uploadPublic(clients, {
    bytes: new TextEncoder().encode(title),
    meta: {
      title,
      description: `Group member ${title}.`,
      tags: ["group", "member"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });
  return art.ipId;
}

async function main() {
  const clients = await getClients();

  // Three member IPs (A, B added at creation; C added after).
  const A = await registerMember(clients, "Member A");
  const B = await registerMember(clients, "Member B");
  const C = await registerMember(clients, "Member C");

  // A group license terms id (in mock just a placeholder string).
  const GROUP_TERMS = "1500";

  const grp = await createGroup(clients.story as any, { ipIds: [A, B], termsId: GROUP_TERMS });
  const groupIpId = grp.groupIpId;
  logTx("register group", grp.txHash);

  const add = await addToGroup(clients.story as any, { groupIpId, ipIds: [C] });
  logTx("add member C", add.txHash);

  const dist = await distribute(clients.story as any, { groupIpId, memberIpIds: [A, B] });

  // OPEN ITEM (SPEC §8.7): group-license -> member vault read-condition unconfirmed;
  // default to per-IP gating.

  console.log("=== 05-group (SPEC §8.7) ===");
  console.log("groupIpId:", groupIpId);
  console.log("members:", [A, B, C]);
  logTx("distribute royalties", dist.txHash);
  console.log("✓ group registered, members added, royalties distributed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
