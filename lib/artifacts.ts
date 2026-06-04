// High-level artifact API — Sui / Walrus / Seal core.
//
// Each upload* function enforces the REGISTER-BEFORE-ENCRYPT invariant:
//   1. register the artifact on-chain (lib/registry.ts) → get `artifactId` (the
//      ArtifactRegistry shared-object id, which is the Seal id prefix) + `capId`.
//   2. Seal-encrypt the plaintext bound to (artifactId, tier) (lib/crypto.ts).
//   3. publish the CIPHERTEXT to Walrus (lib/storage.ts) → get a `blobId`.
//   4. build the public Artifact descriptor and return it.
//
// download() resolves blobId + artifactId + tier, derives the sealId, builds the
// seal_approve tx kind, obtains a Seal SessionKey, reads the ciphertext from the
// Walrus aggregator, and Seal-decrypts. Fail closed on NoAccessError — never retry.
//
// In the public Artifact descriptor, `ipId` is the Sui ArtifactRegistry object id
// and `cid` is the Walrus blobId — see types/artifact.ts. `capId` (ArtifactCap id)
// and `blobObjectId` (Walrus Blob object id) carry the renewal/cap paths.
//
// Invariants honored:
//   - No silent fallbacks; fail closed on NoAccess.
//   - Never log secrets/keys/plaintext.
//   - Encrypt-before-publish (the Walrus layer also guards against plaintext).
//   - Compute tier has NO download path (throws).

import { buildIpaMetadata, type BuildIpaMetadataArgs } from "./metadata";
import { getCrypto, sealIdBytes, SessionKey, NoAccessError } from "./crypto";
import type { ArtifactTier } from "./crypto";
import { getStorage } from "./storage";
import { RegistryClient } from "./registry";
import { STORAGE_EPOCHS } from "./constants";
import type { SuiClient, Signer } from "./clients";
import type { Artifact, Tier } from "../types/artifact";

// --- Types --------------------------------------------------------------

/**
 * Client bundle for the Sui core.
 * Produced by lib/clients.makeClientsFromKey (server) or makeClientsFromProvider
 * (browser, via lib/useClients.getClients). `signer` pays gas + WAL and signs the
 * registry txs; `client` is the read SuiClient; `address` is the on-chain owner.
 */
export interface Clients {
  client: SuiClient;
  signer: Signer;
  address: string;
  account: { address: string };
}

export type UploadMeta = BuildIpaMetadataArgs;

interface UploadInput {
  bytes: Uint8Array;
  meta: UploadMeta;
  /** Commercial terms for gated/compute tiers (rev share %, minting fee).
   *  Carried through to the descriptor / licensing layer (B3). The on-chain
   *  registry register() does NOT take terms; licensing is a separate module. */
  terms?: { rev: number; fee: bigint };
  /** Group id to bind a group-tier artifact to (Option<ID> on-chain). */
  groupId?: string;
}

/** Thrown when a gated download fails (no access, or a storage/decrypt fault). */
export class DownloadGateError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DownloadGateError";
  }
}

// --- Tier mapping -------------------------------------------------------
//
// The app-facing Tier (types/artifact.ts) uses short names; the Seal/registry
// core (lib/crypto.ts ArtifactTier) uses explicit names. Map between them so the
// descriptor keeps the app Tier while the chain/crypto layers get their form.

const APP_TO_CORE: Record<Tier, ArtifactTier> = {
  public: "public",
  private: "private-owner",
  gated: "gated-license",
  group: "group",
  compute: "compute",
};

/** Map an app Tier to its core ArtifactTier (Seal identity + registry u8). */
export function coreTier(tier: Tier): ArtifactTier {
  const t = APP_TO_CORE[tier];
  if (!t) throw new Error(`coreTier: unknown tier "${tier}"`);
  return t;
}

// --- Helpers ------------------------------------------------------------

function ownerOf(clients: Clients): `0x${string}` {
  return (clients.account?.address ?? clients.address) as `0x${string}`;
}

function registry(clients: Clients): RegistryClient {
  return new RegistryClient(clients.client);
}

/** ENFORCE order: register → get artifactId → encrypt. Asserts the id exists. */
function assertArtifactId(id: unknown): asserts id is `0x${string}` {
  if (!id || typeof id !== "string") {
    throw new Error(
      "invariant: artifact must be registered (artifactId) before encrypt/publish",
    );
  }
}

/**
 * Core register → Seal-encrypt → Walrus-publish pipeline shared by every tier.
 *
 * 1. register(tier) on-chain → artifactId (Seal id prefix) + capId.
 * 2. encrypt(artifactId, coreTier, plaintext) → ciphertext (plaintext never leaves
 *    this process unencrypted; the symmetric backup key is discarded in crypto.ts).
 * 3. publishBlob(ciphertext, { signer, owner, epochs }) → blobId + blobObjectId.
 *
 * Callers register first (plain or derivative) and pass the resulting
 * `artifactId` here, so this helper is shared by every upload* path.
 */
async function encryptAndPublish(
  clients: Clients,
  tier: Tier,
  artifactId: string,
  plaintext: Uint8Array,
): Promise<{ blobId: string; blobObjectId: string }> {
  assertArtifactId(artifactId);
  const owner = ownerOf(clients);

  // (2) Seal-encrypt bound to (artifactId, tier). PUBLIC tier is encrypted too:
  // per README, public artifacts are not access-controlled, but seal_approve for
  // the `public` tier admits anyone — so encrypting public bytes is effectively a
  // no-op gate while satisfying the Walrus ciphertext guard and keeping ONE
  // uniform upload/download path for every tier.
  const ciphertext = await getCrypto().encrypt(
    artifactId,
    coreTier(tier),
    plaintext,
  );

  // (3) Publish ciphertext to Walrus. The signer pays gas + WAL; owner owns the blob.
  const { blobId, blobObjectId } = await getStorage().publishBlob(ciphertext, {
    signer: clients.signer,
    owner,
    epochs: STORAGE_EPOCHS,
  });

  return { blobId, blobObjectId };
}

// --- Gated --------------------------------------------------------------

export async function uploadGated(clients: Clients, input: UploadInput): Promise<Artifact> {
  const owner = ownerOf(clients);
  const md = await buildIpaMetadata({ ...input.meta, commercial: true });

  // (1) register on-chain (register-before-encrypt).
  const reg = await registry(clients).register("gated-license", {}, clients.signer);
  assertArtifactId(reg.artifactId);

  // (2)+(3) encrypt + publish ciphertext.
  const { blobId, blobObjectId } = await encryptAndPublish(
    clients,
    "gated",
    reg.artifactId,
    input.bytes,
  );

  return {
    ipId: reg.artifactId as `0x${string}`,
    tier: "gated",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    cid: blobId,
    blobObjectId,
    capId: reg.capId,
    owner,
    createdTx: reg.digest as `0x${string}`,
  };
}

// --- Public -------------------------------------------------------------

export async function uploadPublic(clients: Clients, input: UploadInput): Promise<Artifact> {
  const owner = ownerOf(clients);
  const md = await buildIpaMetadata({ ...input.meta, commercial: false });

  const reg = await registry(clients).register("public", {}, clients.signer);
  assertArtifactId(reg.artifactId);

  // Public tier is Seal-encrypted with the `public` identity (anyone can decrypt
  // via seal_approve). See encryptAndPublish() for the rationale.
  const { blobId, blobObjectId } = await encryptAndPublish(
    clients,
    "public",
    reg.artifactId,
    input.bytes,
  );

  return {
    ipId: reg.artifactId as `0x${string}`,
    tier: "public",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    cid: blobId,
    blobObjectId,
    capId: reg.capId,
    owner,
    createdTx: reg.digest as `0x${string}`,
  };
}

// --- Private (owner-only) -----------------------------------------------

export async function uploadPrivate(clients: Clients, input: UploadInput): Promise<Artifact> {
  const owner = ownerOf(clients);
  const md = await buildIpaMetadata({ ...input.meta, commercial: false });

  const reg = await registry(clients).register("private-owner", {}, clients.signer);
  assertArtifactId(reg.artifactId);

  const { blobId, blobObjectId } = await encryptAndPublish(
    clients,
    "private",
    reg.artifactId,
    input.bytes,
  );

  return {
    ipId: reg.artifactId as `0x${string}`,
    tier: "private",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    cid: blobId,
    blobObjectId,
    capId: reg.capId,
    owner,
    createdTx: reg.digest as `0x${string}`,
  };
}

// --- Compute ------------------------------------------------------------

interface ComputeInput extends UploadInput {
  allowedAlgoHashes: string[];
}

export async function uploadCompute(clients: Clients, input: ComputeInput): Promise<Artifact> {
  const owner = ownerOf(clients);
  const md = await buildIpaMetadata({ ...input.meta, commercial: true });

  const reg = await registry(clients).register("compute", {}, clients.signer);
  assertArtifactId(reg.artifactId);

  // Compute tier: the ciphertext is encrypted to the `compute` Seal identity. Only
  // an allowlisted compute-worker operator (added via RegistryClient.addComputeWorker,
  // B5) can satisfy seal_approve for this tier — a consumer can never decrypt. There
  // is deliberately NO download() path for compute (enforced below).
  const { blobId, blobObjectId } = await encryptAndPublish(
    clients,
    "compute",
    reg.artifactId,
    input.bytes,
  );

  return {
    ipId: reg.artifactId as `0x${string}`,
    tier: "compute",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    cid: blobId,
    blobObjectId,
    capId: reg.capId,
    owner,
    computeEnabled: true,
    allowedAlgoHashes: input.allowedAlgoHashes,
    createdTx: reg.digest as `0x${string}`,
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

/**
 * Register an OSS provenance parent. No bytes are stored — this is a pure on-chain
 * lineage record (public tier) with external_source metadata; the wrapper asserts
 * NO ownership of the upstream artifact.
 */
export async function registerProvenanceParent(
  clients: Clients,
  input: ProvenanceInput,
): Promise<{ ipId: `0x${string}`; licenseTermsId: string; ipMetadataURI: string; createdTx: `0x${string}` }> {
  const owner = ownerOf(clients);

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

  const reg = await registry(clients).register("public", {}, clients.signer);
  assertArtifactId(reg.artifactId);

  return {
    ipId: reg.artifactId as `0x${string}`,
    // The Sui licensing model carries no separate terms id; licensing is enforced
    // by the Move policy. Empty string keeps the public return shape stable for callers.
    licenseTermsId: "",
    ipMetadataURI: md.ipMetadataURI,
    createdTx: reg.digest as `0x${string}`,
  };
}

// --- Derivative ---------------------------------------------------------

interface DerivativeInput {
  /** Parent ArtifactRegistry object id (was parentIpId). */
  parentIpId: `0x${string}`;
  /** Carried for caller compatibility; not used by the Sui registry. */
  parentTermsId?: string;
  bytes: Uint8Array;
  meta: UploadMeta;
}

/**
 * Register a derivative artifact whose lineage points at `parentIpId` (royalties
 * flow upstream — B4). The derivative is stored as a public-tier artifact: register
 * the derivative on-chain, then encrypt + publish its bytes like any public upload.
 */
export async function registerDerivative(
  clients: Clients,
  input: DerivativeInput,
): Promise<Artifact> {
  const owner = ownerOf(clients);
  const md = await buildIpaMetadata({ ...input.meta });

  const reg = await registry(clients).registerDerivative(
    "public",
    input.parentIpId,
    {},
    clients.signer,
  );
  assertArtifactId(reg.artifactId);

  const { blobId, blobObjectId } = await encryptAndPublish(
    clients,
    "public",
    reg.artifactId,
    input.bytes,
  );

  return {
    ipId: reg.artifactId as `0x${string}`,
    tier: "public",
    modality: input.meta.modality,
    title: input.meta.title,
    description: input.meta.description,
    tags: input.meta.tags,
    ipMetadataURI: md.ipMetadataURI,
    cid: blobId,
    blobObjectId,
    capId: reg.capId,
    parentIpId: input.parentIpId,
    owner,
    createdTx: reg.digest as `0x${string}`,
  };
}

// --- Download -----------------------------------------------------------

interface DownloadInput {
  /** ArtifactRegistry object id (descriptor.ipId). */
  ipId: `0x${string}`;
  /** Walrus blobId (descriptor.cid). Preferred over the numeric `uuid` handle. */
  blobId?: string;
  /** Optional numeric artifact handle — ignored when a blobId/cid is present. */
  uuid?: number;
  /** Walrus blobId fallback when callers still pass it as `cid`. */
  cid?: string;
  /** Artifact tier — needed to derive the Seal identity. Defaults via on-chain read. */
  tier?: Tier;
  /** Carried for caller compatibility; unused by the Seal path. */
  licenseTermsId?: string;
  /** Carried for caller compatibility; unused by the Seal path. */
  maxFeeCap?: bigint;
  /** Carried for caller compatibility; the on-chain policy is the real gate. */
  mint?: boolean;
}

/**
 * Server-side SessionKey acquisition. Builds a Seal SessionKey signed by the
 * caller's Ed25519 keypair. Adapted from sharegraph (SessionKey.create with
 * { address, packageId, ttlMin, signer, suiClient }).
 *
 * BROWSER PATH (TODO): in the browser the SessionKey must be signed by the user's
 * Privy/dapp-kit wallet via a personal-message signature. That requires the Privy
 * Sui signing callback to be wired through lib/walletBridge (see lib/useClients.ts
 * TODO(A2/signer)). Until that is done, a browser signer that cannot sign a
 * personal message will throw here — an HONEST failure, never a fake key.
 */
async function makeSessionKey(clients: Clients): Promise<SessionKey> {
  const crypto = getCrypto();
  return SessionKey.create({
    address: ownerOf(clients),
    packageId: crypto.packageId,
    ttlMin: 10,
    signer: clients.signer as never,
    suiClient: clients.client as never,
  });
}

/**
 * Download + Seal-decrypt a gated/private/group/public artifact.
 *
 *   1. resolve blobId + artifactId + tier.
 *   2. sealId = sealIdBytes(artifactId, coreTier(tier)); txBytes = seal_approve.
 *   3. obtain a SessionKey (server: keypair; browser: TODO honest throw).
 *   4. read ciphertext from the Walrus aggregator; Crypto.decrypt(...).
 *
 * Fail closed: a Seal NoAccessError is surfaced as a typed DownloadGateError with
 * a "no access" message and is NEVER retried. COMPUTE tier has no download path —
 * it throws immediately (raw rows must never leave the worker enclave).
 */
export async function download(clients: Clients, input: DownloadInput): Promise<Uint8Array> {
  const artifactId = input.ipId;
  assertArtifactId(artifactId);

  const reg = registry(clients);

  // Resolve the tier — prefer the caller-supplied tier; otherwise read on-chain.
  let tier: Tier | undefined = input.tier;
  let coreT: ArtifactTier;
  if (tier) {
    coreT = coreTier(tier);
  } else {
    const state = await reg.getArtifact(artifactId);
    coreT = state.tier;
  }

  // INVARIANT: compute-tier artifacts have NO download path. Raw rows never leave
  // the confidential-compute worker — consumers run jobs, they do not decrypt.
  if (coreT === "compute") {
    throw new DownloadGateError(
      "compute-tier artifacts cannot be downloaded — run a compute job instead (no raw-row egress)",
    );
  }

  // Resolve the Walrus blobId (descriptor carries it in `cid`; accept `blobId`/`cid`).
  const blobId = input.blobId ?? input.cid;
  if (!blobId) {
    throw new DownloadGateError(
      "download(): missing Walrus blobId (pass blobId or cid — the descriptor's `cid`)",
    );
  }

  // (2) Derive sealId + build the seal_approve tx kind (binds the on-chain policy).
  const sealId = sealIdBytes(artifactId, coreT);
  const txBytes = await reg.buildSealApproveTx(artifactId, sealId);

  // (3) SessionKey for the caller (server keypair; browser path is a TODO throw).
  const sessionKey = await makeSessionKey(clients);

  // (4) Read ciphertext (gasless aggregator) + Seal-decrypt. Fail closed on NoAccess.
  try {
    const ciphertext = await getStorage().readViaAggregator(blobId);
    return await getCrypto().decrypt(ciphertext, sessionKey, txBytes);
  } catch (e) {
    if (e instanceof NoAccessError) {
      // Access denied by on-chain policy. NEVER retry — surface as "no access".
      throw new DownloadGateError("no access — you are not authorized to decrypt this artifact", e);
    }
    throw new DownloadGateError((e as Error)?.message ?? "download failed", e);
  }
}
