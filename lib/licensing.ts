// Licensing helpers — Sui-native on-chain licensing.
//
// In the Sui model a "license" is simply membership of an artifact's on-chain
// `license_holders` set (lib/registry.ts / reef::registry). Holding a license
// is exactly what `seal_approve` checks for the gated-license / group tiers, so
// granting a license == granting decrypt access. There are TWO grant paths:
//
//   - PURCHASE (permissionless): the buyer pays the artifact's `price` in SUI via
//     the Move `buy_license` entry fun, which transfers payment to the owner and
//     adds the buyer to `license_holders`. Backed by RegistryClient.buyLicense.
//   - GRANT (owner, free): the owner uses their ArtifactCap to add a holder via
//     `add_license_holder`. Backed by RegistryClient.addLicenseHolder.
//
// The terms-builder shape (`commercialRemixTerms` / `attributionTerms` /
// `computeTerms` / `resolveTerms`) is plain descriptive metadata exposing
// commercialUse / commercialRevShare / defaultMintingFee. There is no separate
// on-chain terms object on Sui; access is governed entirely by `license_holders`
// + `seal_approve`.
//
// Never logs secrets.

import { RegistryClient } from "./registry";
import type { SuiClient, Signer } from "./clients";

// ---------------------------------------------------------------------------
// Chain-agnostic terms descriptors (metadata only on Sui).
// ---------------------------------------------------------------------------

export interface PilTerms {
  commercialUse: boolean;
  commercialRevShare: number;
  defaultMintingFee: bigint;
  /** Currency label. On Sui the license is paid in native SUI. */
  currency: string;
  attribution?: boolean;
  [k: string]: unknown;
}

export type TermsKind = "commercialRemix" | "attribution" | "compute";

/** Native-SUI currency tag for license payments. */
export const SUI_CURRENCY = "0x2::sui::SUI" as const;

/** Commercial-remix terms (commercial use + revenue share + minting fee). */
export function commercialRemixTerms({ rev, fee }: { rev: number; fee: bigint }): PilTerms {
  return {
    commercialUse: true,
    commercialRevShare: rev,
    defaultMintingFee: fee,
    currency: SUI_CURRENCY,
  };
}

/** Attribution / non-commercial terms (no commercial use). */
export function attributionTerms(): PilTerms {
  return {
    commercialUse: false,
    attribution: true,
    commercialRevShare: 0,
    defaultMintingFee: 0n,
    currency: SUI_CURRENCY,
  };
}

/** Compute-license terms — commercial, used for confidential-compute access. */
export function computeTerms({ rev, fee }: { rev: number; fee: bigint }): PilTerms {
  return {
    commercialUse: true,
    commercialRevShare: rev,
    defaultMintingFee: fee,
    currency: SUI_CURRENCY,
    compute: true,
  };
}

/**
 * Resolve license terms for an artifact tier. On Sui this returns the same plain
 * `PilTerms` descriptor the builders produce (there is no on-chain PIL flavor);
 * kept async + returning `unknown` so existing call sites keep their shape.
 *   - attribution     -> attributionTerms()
 *   - commercialRemix  -> commercialRemixTerms(opts)
 *   - compute          -> computeTerms(opts)
 */
export async function resolveTerms(
  kind: TermsKind,
  opts: { rev: number; fee: bigint } = { rev: 0, fee: 0n },
): Promise<unknown> {
  if (kind === "attribution") return attributionTerms();
  if (kind === "compute") return computeTerms(opts);
  return commercialRemixTerms(opts);
}

// ---------------------------------------------------------------------------
// Access-aux encoding.
// ---------------------------------------------------------------------------

/**
 * Encode the artifact ids a reader claims a license for into an opaque aux blob.
 *
 * The on-chain `seal_approve` policy is the real gate (it reads `license_holders`
 * directly), so no aux data is needed for access. This helper exists for callers
 * that thread an `accessAuxData` value for display/logging; it returns a
 * deterministic JSON-array string of the ids (NOT consumed by seal_approve).
 */
export function encodeAccessAuxData(artifactIds: Array<string | bigint>): string {
  return JSON.stringify(artifactIds.map((x) => x.toString()));
}

// ---------------------------------------------------------------------------
// mintLicense — acquire a license (decrypt access) for an artifact.
// ---------------------------------------------------------------------------

/** Minimal client bundle mintLicense needs (subset of lib/artifacts Clients). */
export interface LicenseClients {
  client: SuiClient;
  signer: Signer;
  address?: string;
}

export interface MintLicenseResult {
  /** The artifact the license was acquired for (the license "subject"). */
  artifactId: string;
  /** Which path granted access. */
  via: "buy_license" | "add_license_holder";
  /** Transaction digest. */
  digest: string;
  /** Price paid in MIST (purchase path), or 0n for an owner grant. */
  pricePaid: bigint;
}

export interface MintLicenseOpts {
  /**
   * PURCHASE path (default): the signer is the buyer and pays SUI. Provide the
   * `price` in MIST explicitly — it MUST match the artifact's on-chain price or
   * the Move `buy_license` aborts. There is no silent price default: if `price`
   * is omitted we read the artifact's on-chain `price` and use it.
   */
  price?: bigint;
  /**
   * OWNER-GRANT path: when set, the artifact owner grants a free license to
   * `grantTo` using their `capId`. Mutually exclusive with the purchase path.
   */
  grant?: { capId: string; grantTo: string };
}

/**
 * Acquire a license for `artifactId`, granting the holder decrypt access for the
 * gated-license / group tier (via on-chain `seal_approve`).
 *
 * Two paths (selected by `opts`):
 *   - GRANT  (opts.grant set): owner adds `grantTo` to `license_holders` for free
 *     using their ArtifactCap. Returns via "add_license_holder".
 *   - BUY    (default): the signer pays SUI via `buy_license`. If `opts.price` is
 *     omitted, the artifact's on-chain `price` is read and used (no fake default).
 *     Returns via "buy_license".
 */
export async function mintLicense(
  clients: LicenseClients,
  artifactId: string,
  opts: MintLicenseOpts = {},
): Promise<MintLicenseResult> {
  const reg = new RegistryClient(clients.client);

  // OWNER-GRANT path: free, cap-gated.
  if (opts.grant) {
    const digest = await reg.addLicenseHolder(
      opts.grant.capId,
      artifactId,
      opts.grant.grantTo,
      clients.signer,
    );
    return { artifactId, via: "add_license_holder", digest, pricePaid: 0n };
  }

  // PURCHASE path: resolve the price (explicit, or the artifact's on-chain price).
  let price = opts.price;
  if (price === undefined) {
    const state = await reg.getArtifact(artifactId);
    price = state.price;
  }
  const digest = await reg.buyLicense(artifactId, price, clients.signer);
  return { artifactId, via: "buy_license", digest, pricePaid: price };
}
