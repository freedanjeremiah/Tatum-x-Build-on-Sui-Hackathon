// Licensing helpers: PIL terms flavors, accessAuxData encoding, and license
// minting.
//
// Terms come in two forms:
//  - The synchronous `*Terms()` builders return plain, well-formed objects so
//    callers (and the licensing tests) can always read commercialRevShare /
//    defaultMintingFee / commercialUse.
//  - `resolveTerms()` is async and returns proper SDK `PILFlavor` LicenseTerms
//    (commercialRemix / creativeCommonsAttribution).
// The real SDK + WIP token are loaded via dynamic import inside resolveTerms.

import { encodeAbiParameters } from "viem";
import { ROYALTY_POLICY_LAP, WIP_OPTIONS } from "./constants";

// WIP token (Story's wrapped IP). Mirrors WIP_TOKEN_ADDRESS exported by
// @story-protocol/core-sdk; in real mode we import that constant directly.
export const WIP_TOKEN = "0x1514000000000000000000000000000000000000" as `0x${string}`;

export interface PilTerms {
  commercialUse: boolean;
  commercialRevShare: number;
  defaultMintingFee: bigint;
  currency: `0x${string}`;
  attribution?: boolean;
  [k: string]: unknown;
}

export type TermsKind = "commercialRemix" | "attribution" | "compute";

/** Commercial-remix PIL terms (commercial use + revenue share + minting fee). */
export function commercialRemixTerms({ rev, fee }: { rev: number; fee: bigint }): PilTerms {
  return {
    commercialUse: true,
    commercialRevShare: rev,
    defaultMintingFee: fee,
    currency: WIP_TOKEN,
  };
}

/** Attribution / non-commercial-social-remixing terms (no commercial use). */
export function attributionTerms(): PilTerms {
  return {
    commercialUse: false,
    attribution: true,
    commercialRevShare: 0,
    defaultMintingFee: 0n,
    currency: WIP_TOKEN,
  };
}

/** Compute-license terms — commercial, used for confidential-compute access. */
export function computeTerms({ rev, fee }: { rev: number; fee: bigint }): PilTerms {
  return {
    commercialUse: true,
    commercialRevShare: rev,
    defaultMintingFee: fee,
    currency: WIP_TOKEN,
    compute: true,
  };
}

/**
 * Resolve license terms for an artifact tier. Returns proper PILFlavor LicenseTerms:
 *  - commercialRemix : PILFlavor.commercialRemix (LAP, WIP currency)
 *  - compute         : PILFlavor.commercialRemix (distinct fee/rev → distinct id)
 *  - attribution     : PILFlavor.creativeCommonsAttribution (LAP, WIP currency)
 */
export async function resolveTerms(
  kind: TermsKind,
  opts: { rev: number; fee: bigint } = { rev: 0, fee: 0n }
): Promise<unknown> {
  const { PILFlavor, WIP_TOKEN_ADDRESS } = await import("@story-protocol/core-sdk");
  // royaltyPolicy must be an ADDRESS (RoyaltyPolicyInput = Address | enum). The
  // string "LAP" is parsed as an address → "Invalid address: LAP". Use the
  // deployed LAP policy address on Aeneid.
  if (kind === "attribution") {
    return PILFlavor.creativeCommonsAttribution({
      currency: WIP_TOKEN_ADDRESS,
      royaltyPolicy: ROYALTY_POLICY_LAP,
    } as any);
  }
  // commercialRemix + compute both use commercialRemix; distinct fee/rev yield
  // distinct on-chain terms ids naturally.
  return PILFlavor.commercialRemix({
    defaultMintingFee: opts.fee,
    commercialRevShare: opts.rev,
    currency: WIP_TOKEN_ADDRESS,
    royaltyPolicy: ROYALTY_POLICY_LAP,
  } as any);
}

/** ABI-encode license token ids into the accessAuxData a read condition needs. */
export function encodeAccessAuxData(tokenIds: bigint[]): `0x${string}` {
  return encodeAbiParameters([{ type: "uint256[]" }], [tokenIds]);
}

/**
 * Mint a license token for `ipId` under `termsId`.
 *
 * `maxFeeCap` is a CAP, not an override: the caller declares the maximum fee
 * (in WIP wei) they are willing to pay. The SDK then auto-wraps EXACTLY the
 * on-chain `defaultMintingFee` from native IP → WIP and auto-approves the
 * royalty module in the same multicall (via WIP_OPTIONS), then mints. If the
 * on-chain fee exceeds `maxFeeCap`, the mint reverts loudly.
 *
 * REQUIRED — there is no silent default cap. Pass the explicit ceiling the
 * caller actually understands. A hidden cap could overcharge a user who saw
 * one fee in the UI but signed for a higher one.
 *
 * Returns the first minted licenseTokenId.
 */
export async function mintLicense(
  story: any,
  ipId: `0x${string}`,
  termsId: string,
  maxFeeCap: bigint,
): Promise<bigint> {
  if (typeof maxFeeCap !== "bigint") {
    throw new Error("mintLicense: maxFeeCap (bigint) is required — no silent fee cap default");
  }
  const res = await story.license.mintLicenseTokens({
    licensorIpId: ipId,
    licenseTermsId: BigInt(termsId),
    amount: 1,
    maxMintingFee: maxFeeCap,
    maxRevenueShare: 100,
    ...WIP_OPTIONS,
  });
  return res.licenseTokenIds[0] as bigint;
}
