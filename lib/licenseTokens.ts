// On-chain read helper for a wallet's Sui licenses.
//
// In the Sui model a "license token" is not an ERC-721 NFT — it is membership of
// an artifact's on-chain `license_holders` set (tessera::registry). So the EVM
// `balanceOf` + `tokenOfOwnerByIndex` enumeration is replaced by:
//   for each KNOWN artifact id, read its ArtifactRegistry via
//   RegistryClient.getArtifact and check whether `owner` is in `licenseHolders`.
//
// HONEST LIMITATION: Sui has no built-in "all objects of type T" index, and
// `license_holders` is stored inside each per-artifact shared object — there is no
// owner-side object to enumerate. A FULL "list every artifact this wallet holds a
// license for" therefore requires an off-chain event indexer (subscribe to the
// `AccessChanged` / `LicensePurchased` events emitted by the Move module). Until
// that indexer exists, this helper checks a CALLER-SUPPLIED candidate list of
// artifact ids and returns exactly the ones the wallet holds — never fabricated
// ids. With no candidates supplied it returns an empty list and marks the result
// `indexed: false` so the UI can render an honest "needs an indexer" state.
//
// Any RPC failure throws so callers can show an honest fallback.

import { RegistryClient } from "./registry";
import type { SuiClient } from "./clients";

export interface LicenseToken {
  /** The artifact (ArtifactRegistry object id) the wallet holds a license for. */
  artifactId: string;
  /** Back-compat alias used by existing UI: the artifact id as the "token id". */
  tokenId: string;
}

export interface LicenseTokenList {
  tokens: LicenseToken[];
  /**
   * true if a complete on-chain enumeration was possible. On Sui this is only
   * true once an event indexer feeds the full candidate set; with a caller-
   * supplied candidate list it reflects "checked exactly these candidates".
   */
  indexed: boolean;
  /** How many candidate artifact ids were checked. */
  checked: number;
}

export interface ListLicenseOpts {
  /**
   * Candidate ArtifactRegistry object ids to check membership against. REQUIRED
   * for any non-empty result until an event indexer exists (see file header).
   * Typically sourced from the app's own catalog of gated artifacts.
   */
  candidateArtifactIds?: string[];
  /** Optional explicit package id for the RegistryClient (defaults to env). */
  packageId?: string;
}

/**
 * List the licenses held by `owner` on Sui. Real on-chain reads only — never
 * fabricates ids. For each candidate artifact id, reads the ArtifactRegistry and
 * keeps it if `owner` is in `licenseHolders` (or is the owner — owners always have
 * gated access via `seal_approve`). Throws on RPC failure.
 *
 * `indexed` is false when no candidate list is supplied (an honest signal that a
 * full enumeration needs an off-chain `AccessChanged`/`LicensePurchased` indexer).
 */
export async function listLicenseTokens(
  client: SuiClient,
  owner: string,
  opts: ListLicenseOpts = {},
): Promise<LicenseTokenList> {
  const candidates = opts.candidateArtifactIds ?? [];

  // No candidates and no indexer: honest empty result, not fabricated data.
  if (candidates.length === 0) {
    // TODO(indexer): subscribe to tessera::registry `AccessChanged` (kind 0) and
    // `LicensePurchased` events to build the full per-wallet candidate set. Until
    // then a complete enumeration is not queryable on-chain.
    return { tokens: [], indexed: false, checked: 0 };
  }

  const reg = new RegistryClient(client, opts.packageId);
  const ownerNorm = owner.toLowerCase();
  const held: LicenseToken[] = [];

  for (const artifactId of candidates) {
    const state = await reg.getArtifact(artifactId);
    const holders = state.licenseHolders.map((h) => h.toLowerCase());
    const isHolder = holders.includes(ownerNorm) || state.owner.toLowerCase() === ownerNorm;
    if (isHolder) held.push({ artifactId, tokenId: artifactId });
  }

  // `indexed: true` here means "the supplied candidate set was fully checked".
  return { tokens: held, indexed: true, checked: candidates.length };
}
