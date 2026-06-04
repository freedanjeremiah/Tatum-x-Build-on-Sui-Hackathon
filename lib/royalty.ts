// Royalty helpers — Sui-native. Each artifact carries its OWN on-chain revenue
// vault (`revenue: Balance<SUI>` in reef::registry):
//
//   - `payRoyalty` pays SUI into an artifact's vault (Move `pay_royalty`). Anyone
//     may pay — a derivative's licensee tipping upstream, a marketplace
//     forwarding a cut, etc. Optionally splits a share up the derivative graph to
//     the `parent` artifact's vault.
//   - `getClaimable` reads the accrued vault balance (Move `revenue` accessor).
//   - `claimRevenue` lets the owner withdraw the accrued balance (Move
//     `claim_revenue`, cap-gated by the ArtifactCap).
//
// Never logs secrets. Fails closed: a failed/aborted tx throws (no silent fallback).

import { RegistryClient } from "./registry";
import type { SuiClient, Signer } from "./clients";

// ---------------------------------------------------------------------------
// Client shapes — accept ServerClients | BrowserClients (both expose
// { client, signer }). A read-only path only needs { client }.
// ---------------------------------------------------------------------------

/** Minimal write-capable client bundle (subset of Server/Browser Clients). */
export interface RoyaltyClients {
  client: SuiClient;
  signer: Signer;
}

/**
 * Thrown when claiming revenue from an artifact whose on-chain vault is empty —
 * i.e. no royalty has ever been paid in, so there is no royalty path to claim.
 * The Move `claim_revenue` aborts with `EEmptyRevenue` in that case; this error
 * surfaces that condition before signing (proactive UI gating) or wraps it.
 */
export class NoRoyaltyVaultError extends Error {
  constructor(public readonly artifactId: string) {
    super(
      `Artifact ${artifactId} has no accrued royalty revenue to claim. Revenue ` +
        "accrues when someone pays a royalty into it (payRoyalty); until then " +
        "there is nothing for the owner to withdraw.",
    );
    this.name = "NoRoyaltyVaultError";
  }
}

// ---------------------------------------------------------------------------
// payRoyalty — pay SUI into an artifact's on-chain revenue vault.
// ---------------------------------------------------------------------------

export interface PayRoyaltyResult {
  /** Tx digest of the payment to the target artifact's vault. */
  txHash: string;
  /** Tx digest of the upstream split to the parent's vault, if `splitToParent`. */
  parentTxHash?: string;
  /** MIST paid into the target artifact's vault. */
  amountToArtifact: bigint;
  /** MIST routed up to the parent's vault (0n if none). */
  amountToParent: bigint;
}

export interface PayRoyaltyOpts {
  /**
   * Fraction (0..100) of `amount` to route UP the derivative graph to the
   * artifact's `parent` vault, when the artifact has a parent. The remainder
   * accrues to this artifact. Defaults to 0 (pay the artifact only). Throws if
   * out of range. If the artifact has no parent, this is ignored (the full
   * amount accrues to the artifact).
   */
  parentSharePct?: number;
}

/**
 * Pay `amount` MIST of royalties to `artifactId`'s on-chain vault. With
 * `opts.parentSharePct > 0` and a parent present, that fraction is split up to
 * the parent's vault in a second `pay_royalty` (honest, explicit — no hidden
 * recursion through the whole ancestry). Returns the tx digest(s) and the split.
 */
export async function payRoyalty(
  clients: RoyaltyClients,
  artifactId: string,
  amount: bigint,
  opts: PayRoyaltyOpts = {},
): Promise<PayRoyaltyResult> {
  if (amount <= 0n) throw new Error("payRoyalty: amount must be > 0");
  const pct = opts.parentSharePct ?? 0;
  if (pct < 0 || pct > 100) throw new Error("payRoyalty: parentSharePct must be 0..100");

  const reg = new RegistryClient(clients.client);

  // Resolve the parent only if a split was requested.
  let parentId: string | null = null;
  if (pct > 0) {
    const state = await reg.getArtifact(artifactId);
    parentId = state.parent;
  }

  const amountToParent = parentId ? (amount * BigInt(pct)) / 100n : 0n;
  const amountToArtifact = amount - amountToParent;

  let parentTxHash: string | undefined;
  if (parentId && amountToParent > 0n) {
    parentTxHash = await reg.payRoyalty(parentId, amountToParent, clients.signer);
  }

  // The artifact always receives at least the remainder (which equals the full
  // amount when there is no parent / no split).
  const txHash =
    amountToArtifact > 0n
      ? await reg.payRoyalty(artifactId, amountToArtifact, clients.signer)
      : (parentTxHash as string);

  return { txHash, parentTxHash, amountToArtifact, amountToParent };
}

// ---------------------------------------------------------------------------
// getClaimable — read an artifact's accrued (claimable) revenue, in MIST.
// ---------------------------------------------------------------------------

/** Read-only client bundle for `getClaimable` (only needs the SuiClient). */
export interface ReadClient {
  client: SuiClient;
}

/**
 * Read `artifactId`'s accrued royalty revenue (claimable by the owner), in MIST.
 * Accepts either a bare SuiClient or a `{ client }` bundle.
 */
export async function getClaimable(
  clientOrBundle: SuiClient | ReadClient,
  artifactId: string,
): Promise<bigint> {
  const client = "client" in clientOrBundle ? clientOrBundle.client : clientOrBundle;
  const reg = new RegistryClient(client as SuiClient);
  return reg.getRevenue(artifactId);
}

// ---------------------------------------------------------------------------
// claimRevenue — owner withdraws the accrued vault balance.
// ---------------------------------------------------------------------------

export interface ClaimRevenueResult {
  txHash: string;
  /** MIST withdrawn (the vault balance read just before the claim). */
  claimed: bigint;
}

/**
 * Owner-only: withdraw ALL accrued revenue from `artifactId`'s vault to the
 * owner, using their `capId` (ArtifactCap). Pre-flights the balance and throws
 * `NoRoyaltyVaultError` if the vault is empty — so a doomed claim is refused
 * before the user signs (the Move `claim_revenue` would otherwise abort with
 * EEmptyRevenue). Returns the tx digest + the claimed amount.
 */
export async function claimRevenue(
  clients: RoyaltyClients,
  artifactId: string,
  capId: string,
): Promise<ClaimRevenueResult> {
  const reg = new RegistryClient(clients.client);
  const claimed = await reg.getRevenue(artifactId);
  if (claimed <= 0n) throw new NoRoyaltyVaultError(artifactId);
  const txHash = await reg.claimRevenue(capId, artifactId, clients.signer);
  return { txHash, claimed };
}
