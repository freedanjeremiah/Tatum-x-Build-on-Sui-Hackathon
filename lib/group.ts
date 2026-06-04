// Group helpers — Sui-native (replaces the Story Group module / even-split pool).
//
// On Sui a group is a shared `Group` object (tessera::registry) that records its
// member artifact ids. Each member artifact also carries `group_id` (so the Seal
// `group` tier keeps gating via the member's own `license_holders`). There is no
// EVM read-condition encoding and no on-chain even-split pool — group revenue is
// realized by claiming each member artifact's own on-chain royalty vault.
//
// No viem, no @story-protocol, no removed EVM constants. Never logs secrets.
// Fails closed: a failed/aborted tx throws (no silent fallback).

import { RegistryClient } from "./registry";
import { claimRevenue, getClaimable, NoRoyaltyVaultError } from "./royalty";
import type { SuiClient, Signer } from "./clients";

/** Minimal write-capable client bundle (subset of Server/Browser Clients). */
export interface GroupClients {
  client: SuiClient;
  signer: Signer;
}

// ---------------------------------------------------------------------------
// createGroup — create the shared Group object and bind initial members.
// ---------------------------------------------------------------------------

export interface CreateGroupResult {
  /** The shared `Group` object id. */
  groupId: string;
  /** Owning `GroupCap` id (held by the creator; gates `add_member`). */
  capId: string;
  /** Tx digest of the create_group call. */
  txHash: string;
  /** Per-member { artifactId, txHash } of the add_member binds (in order). */
  members: Array<{ artifactId: string; txHash: string }>;
}

/**
 * Create a shared `Group` and record `memberArtifactIds` in it (via `add_member`,
 * cap-gated by the new GroupCap). NOTE: binding a member artifact's own
 * `group_id` field requires that member's ArtifactCap — do that separately with
 * `RegistryClient.setGroup` (or pass the caps to `bindGroupId` below). This
 * records membership in the Group object, which is the source of truth for
 * `distribute`.
 */
export async function createGroup(
  clients: GroupClients,
  memberArtifactIds: string[],
): Promise<CreateGroupResult> {
  const reg = new RegistryClient(clients.client);
  const { groupId, capId, digest } = await reg.createGroup(clients.signer);

  const members: Array<{ artifactId: string; txHash: string }> = [];
  for (const artifactId of memberArtifactIds) {
    const txHash = await reg.addMember(capId, groupId, artifactId, clients.signer);
    members.push({ artifactId, txHash });
  }

  return { groupId, capId, txHash: digest, members };
}

// ---------------------------------------------------------------------------
// addToGroup — record more member artifacts in an existing Group.
// ---------------------------------------------------------------------------

export interface AddToGroupResult {
  txHash: string;
  members: Array<{ artifactId: string; txHash: string }>;
}

/**
 * Record additional member artifacts in an existing `Group` using its `groupCapId`.
 * Returns the digest of the LAST add_member (or "" if none) plus the per-member
 * list. Throws if `memberArtifactIds` is empty (no silent no-op).
 */
export async function addToGroup(
  clients: GroupClients,
  groupCapId: string,
  groupId: string,
  memberArtifactIds: string[],
): Promise<AddToGroupResult> {
  if (memberArtifactIds.length === 0) {
    throw new Error("addToGroup: no member artifact ids provided");
  }
  const reg = new RegistryClient(clients.client);
  const members: Array<{ artifactId: string; txHash: string }> = [];
  for (const artifactId of memberArtifactIds) {
    const txHash = await reg.addMember(groupCapId, groupId, artifactId, clients.signer);
    members.push({ artifactId, txHash });
  }
  return { txHash: members[members.length - 1].txHash, members };
}

/**
 * Bind a member artifact's own on-chain `group_id` to `groupId`, using that
 * artifact's ArtifactCap (so the Seal `group` tier resolves to the group). This
 * is the per-artifact, owner-gated counterpart to recording membership in the
 * Group object. Returns the tx digest.
 */
export async function bindGroupId(
  clients: GroupClients,
  artifactCapId: string,
  artifactId: string,
  groupId: string,
): Promise<string> {
  const reg = new RegistryClient(clients.client);
  return reg.setGroup(artifactCapId, artifactId, groupId, clients.signer);
}

// ---------------------------------------------------------------------------
// distribute — realize group revenue by claiming each member's royalty vault.
// ---------------------------------------------------------------------------

export interface DistributeMemberResult {
  artifactId: string;
  /** MIST claimed for this member, or 0n if its vault was empty (skipped). */
  claimed: bigint;
  /** Tx digest of the claim, or null if skipped (empty vault). */
  txHash: string | null;
  /** Present when the claim was skipped or failed, with the reason. */
  skipped?: string;
}

export interface DistributeResult {
  /** Per-member claim outcome. */
  results: DistributeMemberResult[];
  /** Total MIST claimed across all members. */
  totalClaimed: bigint;
}

/**
 * Realize group revenue: for each member, claim its OWN on-chain royalty vault to
 * that member's owner. Each member needs its ArtifactCap (claim_revenue is
 * owner-gated) — so callers pass `{ artifactId, capId }` pairs. Members with an
 * empty vault are skipped (not an error). The per-member outcome is returned.
 *
 * HONEST SCOPE: this is NOT an even-split pool. Sui has no shared group revenue
 * pool in this model — each member artifact accrues its own royalties via
 * `payRoyalty`, and `distribute` simply triggers each member's owner-claim. A
 * true pro-rata split pool (one vault, split N ways) is intentionally out of
 * scope (TODO: add a `GroupRevenue` shared balance + `split_distribute` entry if
 * the product needs a single group pool).
 */
export async function distribute(
  clients: GroupClients,
  members: Array<{ artifactId: string; capId: string }>,
): Promise<DistributeResult> {
  const results: DistributeMemberResult[] = [];
  let totalClaimed = 0n;

  for (const { artifactId, capId } of members) {
    // Read first so an empty vault is a skip, not a thrown abort.
    const claimable = await getClaimable(clients, artifactId);
    if (claimable <= 0n) {
      results.push({ artifactId, claimed: 0n, txHash: null, skipped: "empty vault" });
      continue;
    }
    try {
      const { txHash, claimed } = await claimRevenue(clients, artifactId, capId);
      results.push({ artifactId, claimed, txHash });
      totalClaimed += claimed;
    } catch (e) {
      if (e instanceof NoRoyaltyVaultError) {
        results.push({ artifactId, claimed: 0n, txHash: null, skipped: "empty vault" });
        continue;
      }
      throw e;
    }
  }

  return { results, totalClaimed };
}
