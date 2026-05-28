// Licensing helpers: PIL terms flavors, accessAuxData encoding, and license
// minting.
//
// Terms come in two forms:
//  - The synchronous `*Terms()` builders return plain, well-formed objects so
//    callers (and the licensing tests) can always read commercialRevShare /
//    defaultMintingFee / commercialUse. These are what the MOCK SDK consumes.
//  - `resolveTerms()` is async and, in REAL mode, returns proper SDK
//    `PILFlavor` LicenseTerms (commercialRemix / creativeCommonsAttribution).
//    In MOCK mode it just returns the plain object so nothing else changes.
// The real SDK + WIP token are loaded via dynamic import INSIDE the non-mock
// branch so mock/tests never load them.

import { encodeAbiParameters } from "viem";
import { IS_MOCK } from "./env";
import { ROYALTY_MODULE, ROYALTY_POLICY_LAP } from "./constants";

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
 * Resolve license terms for an artifact tier. MOCK returns the plain object the
 * mock SDK accepts; REAL returns proper PILFlavor LicenseTerms:
 *  - commercialRemix : PILFlavor.commercialRemix (LAP, WIP currency)
 *  - compute         : PILFlavor.commercialRemix (distinct fee/rev → distinct id)
 *  - attribution     : PILFlavor.creativeCommonsAttribution (LAP, WIP currency)
 */
export async function resolveTerms(
  kind: TermsKind,
  opts: { rev: number; fee: bigint } = { rev: 0, fee: 0n }
): Promise<unknown> {
  if (IS_MOCK) {
    if (kind === "attribution") return attributionTerms();
    if (kind === "compute") return computeTerms(opts);
    return commercialRemixTerms(opts);
  }
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
 * Mint a license token for `ipId` under `termsId`. REAL: deposit WIP, approve the
 * royalty module, then mint (maxMintingFee = the deposited fee, maxRevenueShare =
 * 100). MOCK: the mock SDK's mintLicenseTokens ignores fee args. Returns the
 * first minted licenseTokenId.
 */
export async function mintLicense(
  story: any,
  ipId: `0x${string}`,
  termsId: string,
  fee: bigint = 1_000_000_000_000_000_000n
): Promise<bigint> {
  if (!IS_MOCK) {
    await story.wipClient.deposit({ amount: fee });
    await story.wipClient.approve({ spender: ROYALTY_MODULE, amount: fee });
    const res = await story.license.mintLicenseTokens({
      licensorIpId: ipId,
      licenseTermsId: BigInt(termsId),
      amount: 1,
      maxMintingFee: fee,
      maxRevenueShare: 100,
    });
    return res.licenseTokenIds[0] as bigint;
  }
  // MOCK path — unchanged behavior.
  await story.wipClient.deposit({ amount: fee });
  await story.wipClient.approve({ spender: ROYALTY_MODULE, amount: fee });
  const mint = await story.license.mintLicenseTokens({
    licensorIpId: ipId,
    licenseTermsId: BigInt(termsId),
    amount: 1,
  });
  return mint.licenseTokenIds[0] as bigint;
}
