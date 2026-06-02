// Royalty helpers: pay royalties to a child IP, read a parent's claimable
// revenue, and claim all revenue flowing up from children.

import { zeroAddress, type PublicClient } from "viem";
import { ROYALTY_POLICY_LAP, WIP_OPTIONS, ROYALTY_MODULE, RPC_URL } from "./constants";
import { WIP_TOKEN } from "./licensing";

const IP_ROYALTY_VAULTS_ABI = [
  {
    type: "function",
    name: "ipRoyaltyVaults",
    stateMutability: "view",
    inputs: [{ name: "ipId", type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

type VaultReader = Pick<PublicClient, "readContract">;

/**
 * Thrown when paying royalties to an IP that has no royalty vault. The on-chain
 * `RoyaltyModule.payRoyaltyOnBehalf` reverts with `RoyaltyModule__ZeroReceiverVault()`
 * in that case — but only AFTER the auto-wrap multicall has made the user sign
 * and spend gas wrapping native IP → WIP, surfacing as a cryptic "Multicall3:
 * call failed". A vault is deployed lazily when the IP's first commercial
 * license is minted (gated / compute tiers); a non-commercial IP never gets one.
 */
export class NoRoyaltyVaultError extends Error {
  constructor(public readonly ipId: `0x${string}`) {
    super(
      "This IP has no royalty vault yet, so it cannot receive royalties. A " +
        "vault is deployed when the IP's first commercial license is minted " +
        "(gated or compute tier). Mint a license from it first — then royalties " +
        "can be paid.",
    );
    this.name = "NoRoyaltyVaultError";
  }
}

/** Read an IP's royalty vault address (zeroAddress if none deployed yet). */
export async function fetchRoyaltyVault(
  publicClient: VaultReader,
  ipId: `0x${string}`,
): Promise<`0x${string}`> {
  return (await publicClient.readContract({
    address: ROYALTY_MODULE,
    abi: IP_ROYALTY_VAULTS_ABI,
    functionName: "ipRoyaltyVaults",
    args: [ipId],
  })) as `0x${string}`;
}

/** True iff `ipId` has a deployed royalty vault and can receive royalties. */
export async function hasRoyaltyVault(
  publicClient: VaultReader,
  ipId: `0x${string}`,
): Promise<boolean> {
  const vault = await fetchRoyaltyVault(publicClient, ipId);
  return !!vault && vault !== zeroAddress;
}

/**
 * Wallet-free vault check for proactive UI gating — builds its own read-only
 * client so a page can disable "Pay royalty" before the user connects a wallet.
 */
export async function receiverHasRoyaltyVault(
  ipId: `0x${string}`,
): Promise<boolean> {
  const { createPublicClient, http } = await import("viem");
  const { aeneid } = await import("./chains");
  const publicClient = createPublicClient({
    chain: aeneid,
    transport: http(RPC_URL),
  });
  return hasRoyaltyVault(publicClient, ipId);
}

/** Pay royalties on behalf of (to) a child IP. */
export async function payRoyalty(
  story: any,
  {
    childIpId,
    amount,
    publicClient,
  }: {
    childIpId: `0x${string}`;
    amount: bigint;
    /** When provided, pre-flights the receiver's royalty vault so a doomed pay
     *  is refused before the user signs + spends gas on the IP→WIP wrap. */
    publicClient?: VaultReader;
  },
): Promise<{ txHash: `0x${string}` }> {
  if (publicClient && !(await hasRoyaltyVault(publicClient, childIpId))) {
    throw new NoRoyaltyVaultError(childIpId);
  }
  return story.royalty.payRoyaltyOnBehalf({
    receiverIpId: childIpId,
    payerIpId: zeroAddress,
    token: WIP_TOKEN,
    amount,
    ...WIP_OPTIONS,
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
