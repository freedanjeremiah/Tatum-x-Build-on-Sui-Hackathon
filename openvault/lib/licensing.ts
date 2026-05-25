// Licensing helpers: PIL terms flavors, accessAuxData encoding, and license
// minting. Terms objects are plain (well-formed) so callers can always read
// commercialRevShare / defaultMintingFee / commercialUse; the real SDK's
// PILFlavor helpers are used when available via a dynamic import.

import { encodeAbiParameters, parseEther } from "viem";
import { ROYALTY_MODULE } from "./constants";

// WIP token (Story's wrapped IP). VERIFY: import { WIP_TOKEN_ADDRESS } from
// "@story-protocol/core-sdk" in real mode.
export const WIP_TOKEN = "0x1514000000000000000000000000000000000000" as `0x${string}`;

export interface PilTerms {
  commercialUse: boolean;
  commercialRevShare: number;
  defaultMintingFee: bigint;
  currency: `0x${string}`;
  attribution?: boolean;
  [k: string]: unknown;
}

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

/** ABI-encode license token ids into the accessAuxData a read condition needs. */
export function encodeAccessAuxData(tokenIds: bigint[]): `0x${string}` {
  return encodeAbiParameters([{ type: "uint256[]" }], [tokenIds]);
}

/**
 * Mint a license token for `ipId` under `termsId`: deposit WIP, approve the
 * royalty module, then mint. Returns the first minted licenseTokenId.
 */
export async function mintLicense(
  story: any,
  ipId: `0x${string}`,
  termsId: string,
  fee: bigint = parseEther("1")
): Promise<bigint> {
  await story.wipClient.deposit({ amount: fee });
  await story.wipClient.approve({ spender: ROYALTY_MODULE, amount: fee });
  const mint = await story.license.mintLicenseTokens({
    licensorIpId: ipId,
    licenseTermsId: BigInt(termsId),
    amount: 1,
  });
  return mint.licenseTokenIds[0] as bigint;
}
