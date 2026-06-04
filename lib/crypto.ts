// Reef Seal threshold-encryption layer.
//
// Design invariants:
//   - Encrypt-before-publish: plaintext is encrypted here; only ciphertext bytes
//     reach lib/storage.ts (Walrus). Never log secrets or keys.
//   - Fail closed on NoAccessError: decrypt() throws immediately on access denial;
//     callers must NOT retry NoAccessError (policy says "no").
//   - Each artifact's Seal identity is derived from (artifactObjectId, tier) so
//     access policy is isolated per artifact per tier.
//
// Seal decrypt path requires a `seal_approve` transaction kind. The Move entry
// that must exist in the published reef package is:
//
//     ${REEF_PACKAGE_ID}::registry::seal_approve(id: vector<u8>, registry: &ArtifactRegistry)
//
//   `id`       — the 64-byte sealIdBytes for the artifact+tier being decrypted.
//   `registry` — the shared ArtifactRegistry object that holds per-artifact policies.
//
// The Move contract exposes this entry with exactly this argument order. The
// registry adapter (lib/registry.ts) constructs and signs the seal_approve tx
// kind, calling buildSealApproveTx() from this module.

import { SealClient, SessionKey, NoAccessError, EncryptedObject } from '@mysten/seal';
import { blake2b } from '@noble/hashes/blake2b';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { Transaction } from '@mysten/sui/transactions';

import type { SuiClient } from './clients';
import { getReadClient } from './clients';
import {
  SEAL_KEY_SERVER_IDS,
  SEAL_THRESHOLD,
  REEF_PACKAGE_ID,
} from './constants';

// ---------------------------------------------------------------------------
// Re-exports for callers that need to type-annotate Seal primitives.
// ---------------------------------------------------------------------------

export { SessionKey, NoAccessError, EncryptedObject };

// ---------------------------------------------------------------------------
// Reef access tiers — each tier results in a distinct Seal identity so the
// on-chain policy for "public" vs "gated-license" vs "compute" can be enforced
// by separate seal_approve branches in the Move contract.
// ---------------------------------------------------------------------------

export type ArtifactTier =
  | 'public'
  | 'private-owner'
  | 'gated-license'
  | 'group'
  | 'compute';

// ---------------------------------------------------------------------------
// SealConfig — constructor parameter bag.
// ---------------------------------------------------------------------------

export interface SealConfig {
  suiClient: SuiClient;
  keyServerIds: string[];
  threshold: number;
  packageId: string;
  /** Set false only in local integration tests where key servers are stubs. */
  verifyKeyServers?: boolean;
}

// ---------------------------------------------------------------------------
// Seal identity derivation
//
// sealId = artifactObjectId(32 bytes, hex-padded) ++ blake2b256(utf8(tier))(32 bytes)
//
// Mirrors sharegraph's sessionId ++ blake2b256(nodeId) scheme but keyed on
// (artifactObjectId, tier) instead of (sessionId, nodeId). This ensures:
//   - Each artifact has a unique 64-byte identity per tier.
//   - Ciphertext is cryptographically bound to the on-chain registry object id.
//   - Revoking one tier does not affect other tiers of the same artifact.
// ---------------------------------------------------------------------------

/** Strip leading 0x and lowercase; zero-pad to 64 hex chars (32 bytes). */
function rawHex(id: string): string {
  return (id.startsWith('0x') ? id.slice(2) : id).toLowerCase().padStart(64, '0');
}

/**
 * Reef Seal identity bytes for (artifactObjectId, tier).
 *
 *   sealId = artifactObjectId(32 bytes, hex-padded)
 *         ++ blake2b256(utf8(tier))(32 bytes)
 *
 * Total: 64 bytes. Passed to SealClient.encrypt as `id` (hex) and to
 * seal_approve as the `id: vector<u8>` argument.
 */
export function sealIdBytes(artifactObjectId: string, tier: ArtifactTier): Uint8Array {
  const artifact = hexToBytes(rawHex(artifactObjectId)); // 32 bytes
  const tierHash = blake2b(new TextEncoder().encode(tier), { dkLen: 32 }); // 32 bytes
  const out = new Uint8Array(64);
  out.set(artifact, 0);
  out.set(tierHash, 32);
  return out;
}

/**
 * Lowercase hex encoding of sealIdBytes(artifactObjectId, tier).
 * This is the value passed as `id` to SealClient.encrypt.
 */
export function sealIdHex(artifactObjectId: string, tier: ArtifactTier): string {
  return bytesToHex(sealIdBytes(artifactObjectId, tier));
}

// ---------------------------------------------------------------------------
// Crypto class — thin Reef wrapper around SealClient.
// ---------------------------------------------------------------------------

export class Crypto {
  /** Underlying Seal IBE client. Exposed for advanced callers (e.g. SessionKey setup). */
  readonly client: SealClient;
  readonly packageId: string;
  readonly threshold: number;

  constructor(cfg: SealConfig) {
    this.packageId = cfg.packageId;
    this.threshold = cfg.threshold;
    this.client = new SealClient({
      suiClient: cfg.suiClient as never,
      serverConfigs: cfg.keyServerIds.map((objectId) => ({ objectId, weight: 1 })),
      verifyKeyServers: cfg.verifyKeyServers ?? true,
    });
  }

  /**
   * Encrypt `plaintext` for `(artifactObjectId, tier)`.
   *
   * Returns the ciphertext bytes (EncryptedObject serialised by Seal SDK).
   * The symmetric backup key returned by SealClient.encrypt is discarded
   * immediately — it is never stored, logged, or returned. Callers must
   * pass the returned bytes directly to lib/storage.ts `publishBlob`.
   *
   * Flow: derive sealId → SealClient.encrypt → return encryptedObject bytes only.
   */
  async encrypt(
    artifactObjectId: string,
    tier: ArtifactTier,
    plaintext: Uint8Array,
  ): Promise<Uint8Array> {
    const id = sealIdHex(artifactObjectId, tier);
    const { encryptedObject } = await this.client.encrypt({
      threshold: this.threshold,
      packageId: this.packageId,
      id,
      data: plaintext,
    });
    // `key` (symmetric backup) is NOT destructured — intentionally discarded.
    return encryptedObject;
  }

  /**
   * Decrypt `ciphertext` using a pre-fetched `sessionKey` and a seal_approve
   * `txBytes` transaction kind.
   *
   * `txBytes` must be built by task B1 (registry adapter) via
   * `buildSealApproveTx(artifactObjectId, sealId, client)` below. It encodes the
   * Move call `${REEF_PACKAGE_ID}::registry::seal_approve(id, registry)`.
   *
   * Fail-closed contract: if the on-chain policy denies access, Seal throws
   * `NoAccessError`. This method re-throws immediately — callers MUST handle
   * `isNoAccess(e)` and surface a denial to the user. NEVER retry on NoAccessError.
   */
  async decrypt(
    ciphertext: Uint8Array,
    sessionKey: SessionKey,
    txBytes: Uint8Array,
  ): Promise<Uint8Array> {
    return this.client.decrypt({ data: ciphertext, sessionKey, txBytes });
  }
}

// ---------------------------------------------------------------------------
// isNoAccess — type guard / helper for fail-closed NoAccess handling.
// ---------------------------------------------------------------------------

/**
 * Returns true if `e` is a Seal `NoAccessError` (policy denial).
 * Callers should check this before any fallback — there is no fallback for
 * access denial. Never retry a NoAccessError.
 */
export function isNoAccess(e: unknown): boolean {
  return e instanceof NoAccessError;
}

// ---------------------------------------------------------------------------
// buildSealApproveTx — convenience helper for the B1 registry adapter.
//
// Constructs the `seal_approve` transaction kind (onlyTransactionKind: true)
// that Seal's decrypt path requires as `txBytes`.
//
// ASSUMED Move signature (A5 must satisfy):
//   public entry fun seal_approve(
//     id: vector<u8>,          // 64-byte sealIdBytes for the artifact+tier
//     registry: &ArtifactRegistry,   // shared ArtifactRegistry object
//   )
//
// Argument order: id first, registry second — mirrors sharegraph chain.ts
// buildSealApproveTx(sessionId, sealId). Task A5 must match this order exactly.
//
// If the Move signature differs (e.g. registry comes first, or additional
// clock/epoch arguments), update this function and align A5 accordingly.
// ---------------------------------------------------------------------------

/**
 * Build the `seal_approve` transaction kind for Seal decryption.
 *
 * @param artifactObjectId  The Sui object id of the on-chain ArtifactRegistry
 *                          entry (returned by B1 register). Used as the
 *                          `registry` argument.
 * @param sealId            The 64-byte seal identity (from sealIdBytes).
 * @param suiClient         SuiClient used to resolve gas/object refs for tx.build.
 * @param packageId         Reef package id (defaults to REEF_PACKAGE_ID).
 *
 * Returns the BCS-encoded transaction-kind bytes to pass to `Crypto.decrypt`.
 *
 * NOTE: This helper lives here for convenience but the registry adapter owns the
 * call site. It supplies the correct `artifactObjectId` (ArtifactRegistry shared
 * object) and `sealId` derived via `sealIdBytes`.
 */
export async function buildSealApproveTx(
  artifactObjectId: string,
  sealId: Uint8Array,
  suiClient: SuiClient,
  packageId: string = REEF_PACKAGE_ID,
): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    // The Move module name is `registry` and the gate function is `seal_approve`.
    target: `${packageId}::registry::seal_approve`,
    arguments: [
      tx.pure.vector('u8', sealId),     // id: vector<u8>
      tx.object(artifactObjectId),      // registry: &ArtifactRegistry (shared object)
    ],
  });
  return tx.build({ client: suiClient as never, onlyTransactionKind: true });
}

// ---------------------------------------------------------------------------
// Module singleton — getCrypto()
//
// Lazy, memo-ised instance configured from lib/constants.ts defaults.
// Mirrors getStorage() in lib/storage.ts and getReadClient() in lib/clients.ts.
//
// Throws if SEAL_KEY_SERVER_IDS is empty or REEF_PACKAGE_ID is unset —
// the Crypto class cannot function without these.
// ---------------------------------------------------------------------------

let _crypto: Crypto | undefined;

/**
 * Returns the shared Crypto singleton, configured from environment constants.
 *
 * Throws clearly if SEAL_KEY_SERVER_IDS or REEF_PACKAGE_ID are not set,
 * rather than silently constructing a broken SealClient.
 *
 * Pass `cfg` to override any field (e.g. in tests with stub key servers).
 */
export function getCrypto(cfg?: Partial<SealConfig>): Crypto {
  if (_crypto && !cfg) return _crypto;

  const keyServerIds = cfg?.keyServerIds ?? SEAL_KEY_SERVER_IDS;
  if (!keyServerIds || keyServerIds.length === 0) {
    throw new Error(
      'Missing SEAL_KEY_SERVER_IDS — set NEXT_PUBLIC_OV_SEAL_KEY_SERVER_IDS or ' +
      'OV_SEAL_KEY_SERVER_IDS to a comma-separated list of Seal key-server object ids.',
    );
  }

  const packageId = cfg?.packageId ?? REEF_PACKAGE_ID;
  if (!packageId || packageId.trim() === '') {
    throw new Error(
      'Missing REEF_PACKAGE_ID — set NEXT_PUBLIC_OV_REEF_PACKAGE_ID or ' +
      'OV_REEF_PACKAGE_ID to the published reef Move package object id.',
    );
  }

  const resolved: SealConfig = {
    suiClient: cfg?.suiClient ?? getReadClient(),
    keyServerIds,
    threshold: cfg?.threshold ?? SEAL_THRESHOLD,
    packageId,
    verifyKeyServers: cfg?.verifyKeyServers,
  };

  const instance = new Crypto(resolved);
  if (!cfg) _crypto = instance; // only memoize the default (no-override) instance
  return instance;
}
