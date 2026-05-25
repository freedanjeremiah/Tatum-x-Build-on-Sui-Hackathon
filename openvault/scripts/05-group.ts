// SPEC §8.7 — Group bundle.
//
// Register a group with even-split rewards, attach a license, add member IPs,
// add one more, then collect + distribute group royalties to the members.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/05-group.ts

import { getClients, logTx } from "./_util";
import { PUBLIC_SPG_COLLECTION, EVEN_SPLIT_GROUP_POOL } from "../lib/constants";

// VERIFY: import { WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk"
const WIP = "0x1514000000000000000000000000000000000000" as `0x${string}`;

async function registerMember(story: any, title: string): Promise<`0x${string}`> {
  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: { commercialRevShare: 5 } }],
    ipMetadata: {},
  } as any);
  return reg.ipId as `0x${string}`;
}

async function main() {
  const { story } = await getClients();

  // Three member IPs (A, B added at creation; C added after).
  const A = await registerMember(story, "Member A");
  const B = await registerMember(story, "Member B");
  const C = await registerMember(story, "Member C");

  // A group license terms id (in mock just a placeholder string).
  const GROUP_TERMS = "1500";

  const grp = await story.groupClient.registerGroupAndAttachLicenseAndAddIps({
    groupPool: EVEN_SPLIT_GROUP_POOL,
    maxAllowedRewardShare: 5,
    ipIds: [A, B],
    licenseData: { licenseTermsId: GROUP_TERMS },
  } as any);
  const groupIpId = ((grp as any).groupId ?? (grp as any).groupIpId) as `0x${string}`;
  logTx("register group", (grp as any).txHash);

  const add = await story.groupClient.addIpsToGroup({ groupIpId, ipIds: [C] } as any);
  logTx("add member C", (add as any).txHash);

  const dist = await story.groupClient.collectAndDistributeGroupRoyalties({
    groupIpId,
    currencyTokens: [WIP],
    memberIpIds: [A, B],
  } as any);

  // OPEN ITEM (SPEC §8.7): group-license -> member vault read-condition unconfirmed;
  // default to per-IP gating.

  console.log("=== 05-group (SPEC §8.7) ===");
  console.log("groupIpId:", groupIpId);
  console.log("members:", [A, B, C]);
  logTx("distribute royalties", (dist as any).txHash);
  console.log("✓ group registered, members added, royalties distributed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
