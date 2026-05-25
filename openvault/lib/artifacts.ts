// High-level artifact API. Each upload* function enforces the core invariant:
// register the IP Asset FIRST (so we have an ipId), then upload to the CDR vault
// gated by that ipId. download() acquires a license token if needed, encodes
// accessAuxData, and decrypts via the CDR consumer.

import { encodeAbiParameters } from "viem";
import { IS_MOCK } from "./env";
import {
  PUBLIC_SPG_COLLECTION,
  OWNER_WRITE_CONDITION,
  LICENSE_READ_CONDITION,
  LICENSE_TOKEN,
} from "./constants";
import { buildIpaMetadata, type BuildIpaMetadataArgs } from "./metadata";
import { pinFile } from "./storage";
import { heliaProvider } from "./storage";
import {
  commercialRemixTerms,
  attributionTerms,
  computeTerms,
  encodeAccessAuxData,
  mintLicense,
} from "./licensing";
import type { Artifact } from "../types/artifact";

// --- Types --------------------------------------------------------------

/** A {cdr, story, account} bundle (mock or real). */
export interface Clients {
  cdr: any;
  story: any;
  account: { address: `0x${string}` };
}

export type UploadMeta = BuildIpaMetadataArgs;

interface UploadInput {
  bytes: Uint8Array;
  meta: UploadMeta;
}

/** Thrown when a gated download fails (no license, or a vault timeout). */
export class DownloadGateError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DownloadGateError";
  }
}

// --- Helpers ------------------------------------------------------------

function ownerOf(clients: Clients): `0x${string}` {
  return clients.account.address;
}

/** Capture the real licenseTermsId from a registerIpAsset return (never hardcode). */
function termsIdOf(reg: any): string {
  return String(reg.licenseTermsId ?? reg.licenseTermsIds?.[0] ?? "");
}

/** ENFORCE order: register → get ipId → upload. Asserts the ipId exists. */
function assertIpId(ipId: unknown): asserts ipId is `0x${string}` {
  if (!ipId || typeof ipId !== "string") {
    throw new Error("invariant: IP must be registered (ipId) before uploadFile");
  }
}

// --- Gated --------------------------------------------------------------

export async function uploadGated(clients: Clients, input: UploadInput): Promise<Artifact> {
  const { cdr, story } = clients;
  const owner = ownerOf(clients);

  const md = await buildIpaMetadata({ ...input.meta, commercial: true });
  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: commercialRemixTerms({ rev: 5, fee: 1n }) }],
    ipMetadata: {
      ipMetadataURI: md.ipMetadataURI,
      ipMetadataHash: md.ipMetadataHash,
      nftMetadataURI: md.nftMetadataURI,
      nftMetadataHash: md.nftMetadataHash,
    },
  });
  const ipId = reg.ipId as `0x${string}`;
  assertIpId(ipId);
  const licenseTermsId = termsIdOf(reg);

  const storageProvider = await heliaProvider();
  const writeConditionData = encodeAbiParameters([{ type: "address" }], [owner]);
  // Real read condition = LicenseReadCondition(LICENSE_TOKEN, ipId); the mock
  // vault keys its gate purely on the ipId.
  const readConditionDataReal = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [LICENSE_TOKEN, ipId]
  );
  const up = await cdr.uploader.uploadFile({
    content: input.bytes,
    storageProvider,
    globalPubKey: await cdr.observer.getGlobalPubKey(),
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    readConditionAddr: LICENSE_READ_CONDITION,
    writeConditionData,
    readConditionData: IS_MOCK ? ipId : readConditionDataReal,
    accessAuxData: "0x",
  });

  return {
    ipId,
    tier: "gated",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    vaultUuid: up.uuid,
    cid: up.cid,
    licenseTermsId,
    createdTx: reg.txHash,
  };
}

// --- Public -------------------------------------------------------------

export async function uploadPublic(clients: Clients, input: UploadInput): Promise<Artifact> {
  const { story } = clients;

  const md = await buildIpaMetadata({ ...input.meta, commercial: false });
  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: attributionTerms() }],
    ipMetadata: {
      ipMetadataURI: md.ipMetadataURI,
      ipMetadataHash: md.ipMetadataHash,
      nftMetadataURI: md.nftMetadataURI,
      nftMetadataHash: md.nftMetadataHash,
    },
  });
  const ipId = reg.ipId as `0x${string}`;
  assertIpId(ipId);

  // Public tier: pin the file in clear (no vault).
  const pinned = await pinFile(input.bytes);

  return {
    ipId,
    tier: "public",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    cid: pinned.uri,
    licenseTermsId: termsIdOf(reg),
    createdTx: reg.txHash,
  };
}

// --- Private ------------------------------------------------------------

export async function uploadPrivate(clients: Clients, input: UploadInput): Promise<Artifact> {
  const { cdr, story } = clients;
  const owner = ownerOf(clients);

  const md = await buildIpaMetadata({ ...input.meta, commercial: false });
  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: attributionTerms() }],
    ipMetadata: {
      ipMetadataURI: md.ipMetadataURI,
      ipMetadataHash: md.ipMetadataHash,
      nftMetadataURI: md.nftMetadataURI,
      nftMetadataHash: md.nftMetadataHash,
    },
  });
  const ipId = reg.ipId as `0x${string}`;
  assertIpId(ipId);

  const storageProvider = await heliaProvider();
  const ownerCondData = encodeAbiParameters([{ type: "address" }], [owner]);
  // Allocate-then-write with EOA owner read/write conditions.
  const alloc = await cdr.uploader.allocate({
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    readConditionAddr: OWNER_WRITE_CONDITION, // owner-gated read
    writeConditionData: ownerCondData,
    readConditionData: IS_MOCK ? owner : ownerCondData,
    skipConditionValidation: true,
  });
  const uuid = alloc.uuid;
  const wr = await cdr.uploader.write({ uuid, content: input.bytes, storageProvider });

  return {
    ipId,
    tier: "private",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    vaultUuid: uuid,
    cid: wr.cid,
    licenseTermsId: termsIdOf(reg),
    createdTx: reg.txHash,
  };
}

// --- Compute ------------------------------------------------------------

interface ComputeInput extends UploadInput {
  allowedAlgoHashes: string[];
}

export async function uploadCompute(clients: Clients, input: ComputeInput): Promise<Artifact> {
  const { cdr, story } = clients;

  const md = await buildIpaMetadata({ ...input.meta, commercial: true });
  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: computeTerms({ rev: 5, fee: 1n }) }],
    ipMetadata: {
      ipMetadataURI: md.ipMetadataURI,
      ipMetadataHash: md.ipMetadataHash,
      nftMetadataURI: md.nftMetadataURI,
      nftMetadataHash: md.nftMetadataHash,
    },
  });
  const ipId = reg.ipId as `0x${string}`;
  assertIpId(ipId);
  const computeLicenseTermsId = termsIdOf(reg);

  const storageProvider = await heliaProvider();
  const readConditionDataReal = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [LICENSE_TOKEN, ipId]
  );
  const up = await cdr.uploader.uploadFile({
    content: input.bytes,
    storageProvider,
    globalPubKey: await cdr.observer.getGlobalPubKey(),
    updatable: false,
    readConditionAddr: LICENSE_READ_CONDITION,
    readConditionData: IS_MOCK ? ipId : readConditionDataReal,
    accessAuxData: "0x",
  });

  return {
    ipId,
    tier: "compute",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    vaultUuid: up.uuid,
    cid: up.cid,
    computeEnabled: true,
    allowedAlgoHashes: input.allowedAlgoHashes,
    computeLicenseTermsId,
    createdTx: reg.txHash,
  };
}

// --- Provenance parent (OSS) -------------------------------------------

interface ProvenanceInput {
  externalSource: string;
  upstreamLicense: string;
  authors: string[];
  title: string;
  description?: string;
  tags?: string[];
}

export async function registerProvenanceParent(
  clients: Clients,
  input: ProvenanceInput
): Promise<{ ipId: `0x${string}`; licenseTermsId: string; ipMetadataURI: string; createdTx: `0x${string}` }> {
  const { story } = clients;
  const owner = ownerOf(clients);

  // Attribution-only metadata with external_source; no false ownership claim.
  const md = await buildIpaMetadata({
    title: input.title,
    description:
      input.description ??
      `Provenance record for an external open-source artifact. Wrapper asserts no ownership. Upstream license: ${input.upstreamLicense}. Authors: ${input.authors.join(", ")}.`,
    tags: input.tags ?? ["oss", "provenance"],
    creators: input.authors.map((name) => ({
      name,
      address: owner,
      contributionPercent: Math.floor(100 / input.authors.length),
    })),
    modality: "model",
    externalSource: input.externalSource,
    // commercial omitted → provenance only
  });

  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: attributionTerms() }],
    ipMetadata: {
      ipMetadataURI: md.ipMetadataURI,
      ipMetadataHash: md.ipMetadataHash,
      nftMetadataURI: md.nftMetadataURI,
      nftMetadataHash: md.nftMetadataHash,
    },
  });
  const ipId = reg.ipId as `0x${string}`;
  assertIpId(ipId);
  return {
    ipId,
    licenseTermsId: termsIdOf(reg),
    ipMetadataURI: md.ipMetadataURI,
    createdTx: reg.txHash,
  };
}

// --- Derivative ---------------------------------------------------------

interface DerivativeInput {
  parentIpId: `0x${string}`;
  parentTermsId: string;
  bytes: Uint8Array;
  meta: UploadMeta;
}

export async function registerDerivative(
  clients: Clients,
  input: DerivativeInput
): Promise<Artifact> {
  const { story } = clients;

  const md = await buildIpaMetadata({ ...input.meta });
  const child = await story.ipAsset.registerDerivativeIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    derivData: { parentIpIds: [input.parentIpId], licenseTermsIds: [input.parentTermsId] },
    ipMetadata: {
      ipMetadataURI: md.ipMetadataURI,
      ipMetadataHash: md.ipMetadataHash,
      nftMetadataURI: md.nftMetadataURI,
      nftMetadataHash: md.nftMetadataHash,
    },
  });
  const ipId = child.ipId as `0x${string}`;
  assertIpId(ipId);

  return {
    ipId,
    tier: "public",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    parentIpId: input.parentIpId,
    createdTx: child.txHash,
  };
}

// --- Download -----------------------------------------------------------

interface DownloadInput {
  ipId: `0x${string}`;
  uuid: number;
  licenseTermsId: string;
  /** When false, do not mint a license (used to prove the no-token revert). */
  mint?: boolean;
}

/**
 * Download + decrypt a gated/compute vault artifact. Mints a license token if
 * the reader lacks one, encodes accessAuxData, then calls the CDR consumer.
 * A PartialCollectionTimeoutError (or any vault failure) is rethrown as a typed
 * DownloadGateError the UI can show.
 */
export async function download(clients: Clients, input: DownloadInput): Promise<Uint8Array> {
  const { cdr, story } = clients;
  const shouldMint = input.mint !== false && !!input.licenseTermsId;

  let accessAuxData: string;
  if (IS_MOCK) {
    // The mock vault keys its gate on a token minted via __mintFor(ipId).
    accessAuxData = shouldMint ? await cdr.__mintFor(input.ipId) : "0x";
  } else {
    if (shouldMint) {
      const tokenId = await mintLicense(story, input.ipId, input.licenseTermsId);
      accessAuxData = encodeAccessAuxData([tokenId]);
    } else {
      accessAuxData = "0x";
    }
  }

  const storageProvider = await heliaProvider();
  try {
    const out = await cdr.consumer.downloadFile({
      uuid: input.uuid,
      accessAuxData,
      storageProvider,
      timeoutMs: 120000,
    });
    return out.content as Uint8Array;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "PartialCollectionTimeoutError") {
      throw new DownloadGateError(
        "Vault read timed out before the decryption key could be collected.",
        e
      );
    }
    throw new DownloadGateError((e as Error).message, e);
  }
}
