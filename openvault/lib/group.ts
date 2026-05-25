// Group helpers: register a group with even-split rewards + an attached license,
// add member IPs, and collect + distribute group royalties.
//
// OPEN ITEM (SPEC §8.7): the group-license -> member vault read-condition path is
// unconfirmed. Until confirmed, gating falls back to per-IP gating (each member
// IP keeps its own LicenseReadCondition); the group only governs reward splits.

import { EVEN_SPLIT_GROUP_POOL } from "./constants";
import { WIP_TOKEN } from "./licensing";

/** Register a group, attach a license, and add initial member IPs. */
export async function createGroup(
  story: any,
  { ipIds, termsId }: { ipIds: `0x${string}`[]; termsId: string }
): Promise<{ groupIpId: `0x${string}`; txHash: `0x${string}` }> {
  const grp = await story.groupClient.registerGroupAndAttachLicenseAndAddIps({
    groupPool: EVEN_SPLIT_GROUP_POOL,
    maxAllowedRewardShare: 5,
    ipIds,
    licenseData: { licenseTermsId: termsId },
  });
  const groupIpId = (grp.groupId ?? grp.groupIpId) as `0x${string}`;
  return { groupIpId, txHash: grp.txHash };
}

/** Add more member IPs to an existing group. */
export async function addToGroup(
  story: any,
  { groupIpId, ipIds }: { groupIpId: `0x${string}`; ipIds: `0x${string}`[] }
): Promise<{ txHash: `0x${string}` }> {
  return story.groupClient.addIpsToGroup({ groupIpId, ipIds });
}

/** Collect + distribute group royalties to the named member IPs. */
export async function distribute(
  story: any,
  { groupIpId, memberIpIds }: { groupIpId: `0x${string}`; memberIpIds: `0x${string}`[] }
): Promise<{ txHash: `0x${string}` }> {
  return story.groupClient.collectAndDistributeGroupRoyalties({
    groupIpId,
    currencyTokens: [WIP_TOKEN],
    memberIpIds,
  });
}
