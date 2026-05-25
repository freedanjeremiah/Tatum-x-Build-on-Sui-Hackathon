// Royalty helpers: pay royalties to a child IP, read a parent's claimable
// revenue, and claim all revenue flowing up from children.

import { zeroAddress } from "viem";
import { ROYALTY_POLICY_LAP } from "./constants";
import { WIP_TOKEN } from "./licensing";

/** Pay royalties on behalf of (to) a child IP. */
export async function payRoyalty(
  story: any,
  { childIpId, amount }: { childIpId: `0x${string}`; amount: bigint }
): Promise<{ txHash: `0x${string}` }> {
  return story.royalty.payRoyaltyOnBehalf({
    receiverIpId: childIpId,
    payerIpId: zeroAddress,
    token: WIP_TOKEN,
    amount,
  });
}

/** Claim all revenue flowing up to a parent IP from its children. */
export async function claimRevenue(
  story: any,
  { parentIpId, childIpIds }: { parentIpId: `0x${string}`; childIpIds: `0x${string}`[] }
): Promise<{ txHash: `0x${string}` }> {
  return story.royalty.claimAllRevenue({
    ancestorIpId: parentIpId,
    claimer: parentIpId,
    childIpIds,
    royaltyPolicies: childIpIds.map(() => ROYALTY_POLICY_LAP),
    currencyTokens: childIpIds.map(() => WIP_TOKEN),
  });
}

/** Read an IP's claimable revenue (in WIP wei). */
export async function getClaimable(
  story: any,
  { ipId }: { ipId: `0x${string}` }
): Promise<bigint> {
  return (await story.royalty.claimableRevenue({
    ipId,
    claimer: ipId,
    token: WIP_TOKEN,
  })) as bigint;
}
