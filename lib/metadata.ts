// IPA + NFT metadata builder. Constructs metadata JSON per the Story IPA
// metadata standard, pins both via lib/storage.pinJSON, and returns the four
// fields registerIpAsset needs.
//
// Provenance rule: when `externalSource` is set (an OSS parent), the metadata
// records the external source and asserts NO commercial terms (provenance only).

import { pinJSON } from "./storage";
import type { Modality } from "../types/artifact";

export interface Creator {
  name: string;
  address: `0x${string}`;
  contributionPercent: number;
}

export interface BuildIpaMetadataArgs {
  title: string;
  description: string;
  tags: string[];
  creators: Creator[];
  modality: Modality;
  /** External OSS source URL — when set, this is a provenance-only parent. */
  externalSource?: string;
  /** Commercial intent. Ignored (forced off) when externalSource is set. */
  commercial?: boolean;
}

export interface IpaMetadataResult {
  ipMetadataURI: string;
  ipMetadataHash: `0x${string}`;
  nftMetadataURI: string;
  nftMetadataHash: `0x${string}`;
  /** The exact JSON strings pinned (for tests / hashing verification). */
  __ipMetadataJSON?: string;
  __nftMetadataJSON?: string;
}

/**
 * Build + pin IPA and NFT metadata, returning the registerIpAsset fields.
 */
export async function buildIpaMetadata(
  args: BuildIpaMetadataArgs
): Promise<IpaMetadataResult> {
  const { title, description, tags, creators, modality, externalSource } = args;
  // Provenance parents never assert commercial terms.
  const commercial = externalSource ? false : !!args.commercial;

  // IPA metadata per Story's standard (https://docs.story.foundation).
  const ipMetadata: Record<string, unknown> = {
    title,
    description,
    tags,
    creators,
    // Custom OpenVault fields used across the app.
    modality,
  };
  if (externalSource) {
    ipMetadata.external_source = externalSource;
  } else if (commercial) {
    // Only carry a commercial assertion when this is NOT a provenance wrapper.
    ipMetadata.commercial = true;
  }

  const nftMetadata = {
    name: `${title} — OpenVault IP NFT`,
    description: `Ownership NFT for the OpenVault artifact "${title}".`,
  };

  const { uri: ipMetadataURI, hash: ipMetadataHash } = await pinJSON(ipMetadata);
  const { uri: nftMetadataURI, hash: nftMetadataHash } = await pinJSON(nftMetadata);

  return {
    ipMetadataURI,
    ipMetadataHash,
    nftMetadataURI,
    nftMetadataHash,
    __ipMetadataJSON: JSON.stringify(ipMetadata),
    __nftMetadataJSON: JSON.stringify(nftMetadata),
  };
}
