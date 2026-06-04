// IPA + NFT metadata builder. Constructs metadata JSON per the Story IPA
// metadata standard and returns the four fields the registration flow needs.
//
// SUI MIGRATION (B2): the old Pinata/IPFS pinJSON write path is gone (lib/storage
// pinJSON now throws — it is a write shim). Public artifact metadata is small,
// non-secret JSON; we content-address it LOCALLY (sha-256) and return a
// deterministic `walrus-meta://<sha256>` URI plus the matching hash. No network
// write, no fake pin, no secrets. Durable off-chain metadata persistence (e.g. a
// dedicated public Walrus blob or an off-chain store with a Signer) is deferred to
// a later phase; the descriptor still carries a stable, verifiable content hash.
//
// Provenance rule: when `externalSource` is set (an OSS parent), the metadata
// records the external source and asserts NO commercial terms (provenance only).

import { sha256Hex } from "./storage";
import type { Modality } from "../types/artifact";

export interface Creator {
  name: string;
  // Sui addresses are plain 0x+64hex strings; widened to `string` so browser
  // signer addresses (typed `string` in BrowserClients) flow without a cast.
  address: string;
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
    // Custom Tessera fields used across the app.
    modality,
  };
  if (externalSource) {
    ipMetadata.external_source = externalSource;
  } else if (commercial) {
    // Only carry a commercial assertion when this is NOT a provenance wrapper.
    ipMetadata.commercial = true;
  }

  const nftMetadata = {
    name: `${title} — Tessera IP NFT`,
    description: `Ownership NFT for the Tessera artifact "${title}".`,
  };

  // Content-address locally (no network write). The hash is the durable, stable
  // identity; the uri is a `walrus-meta://<sha256>` content reference.
  const ipJSON = JSON.stringify(ipMetadata);
  const nftJSON = JSON.stringify(nftMetadata);
  const ipMetadataHash = sha256Hex(ipJSON);
  const nftMetadataHash = sha256Hex(nftJSON);
  const ipMetadataURI = `walrus-meta://${ipMetadataHash.slice(2)}`;
  const nftMetadataURI = `walrus-meta://${nftMetadataHash.slice(2)}`;

  return {
    ipMetadataURI,
    ipMetadataHash,
    nftMetadataURI,
    nftMetadataHash,
    __ipMetadataJSON: JSON.stringify(ipMetadata),
    __nftMetadataJSON: JSON.stringify(nftMetadata),
  };
}
