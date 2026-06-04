export type Tier = "public" | "private" | "gated" | "group" | "compute";
export type Modality = "dataset" | "model";

export interface Artifact {
  // The public descriptor uses two on-chain/storage identifiers:
  //   - `ipId`  → the Sui `ArtifactRegistry` shared-object id (0x + 64 hex).
  //               This is what `lib/registry.ts` returns as `artifactId` and what
  //               `sealIdBytes(artifactId, tier)` is keyed on. A 0x-hex string, so
  //               /api/index validation holds.
  //   - `cid`   → the Walrus `blobId` for the artifact's (encrypted) blob. Not
  //               0x-hex (Walrus ids are base64url) — /api/index only requires
  //               `cid` to be a string, so this is fine.
  ipId: `0x${string}`;
  tier: Tier;
  modality: Modality;
  title: string;
  description: string;
  tags: string[];
  ipMetadataURI: string;
  vaultUuid?: number;
  cid?: string;
  licenseTermsId?: string;
  parentIpId?: `0x${string}`;
  groupId?: `0x${string}`;
  ownerNftTokenId?: bigint;
  // EOA (wallet) that registered this IP asset — distinct from the NFT token id.
  owner?: `0x${string}`;
  createdTx: `0x${string}`;
  // v2:
  computeEnabled?: boolean;
  allowedAlgoHashes?: string[];
  computeLicenseTermsId?: string;
  externalSource?: string;
  score?: number; // leaderboard metric
  // --- Sui core ------------------------------------------------------------
  /** ArtifactCap object id minted to the owner at register time. Held by the
   *  owner; gates every cap-protected entry fun (add_license_holder, revoke,
   *  add_compute_worker, set_group). Not indexed publicly by default. */
  capId?: string;
  /** Walrus Blob OBJECT id (on-chain), distinct from the blobId (in `cid`).
   *  Needed for `extend`/`deleteBlob` storage renewal/GC. */
  blobObjectId?: string;
}

export interface ComputeJob {
  id: string;
  datasetIpId: `0x${string}`;
  consumer: `0x${string}`;
  algoHash: string;
  computeLicenseTokenId: bigint;
  status: "pending" | "verifying" | "running" | "done" | "rejected" | "failed";
  resultIpId?: `0x${string}`;
  metricsURI?: string;
}

/**
 * The outcome of a compute run. RESULTS ONLY — raw rows are NEVER returned.
 * Either a "done" run with aggregate metrics + a derivative resultIpId, or a
 * "rejected" run (algorithm not on the dataset allowlist) where `decryptCalled`
 * is provably false: the worker refused before any decryption.
 */
/** Sim quote shape (server-only) — declared here so client code can type-check
 *  it without importing node:crypto via lib/tee-sim. */
export interface SimulatedQuoteInfo {
  kind: "sim-sgx-quote";
  header: {
    teeType: "SGX-SIM";
    version: 1;
    qeSvn: number;
    pceSvn: number;
    qeVendorId: string;
  };
  body: {
    mrEnclave: `0x${string}`;
    mrSigner: `0x${string}`;
    isvProdId: number;
    isvSvn: number;
    reportData: `0x${string}`;
  };
  signature: `0x${string}`;
  generatedAt: string;
  disclosure: string;
}

export interface AttestationInfo {
  validatorAttestationEnabled: boolean;
  enforced: boolean;
  untrustedValidators: number;
  /** "enclave-nautilus" = real AWS Nitro enclave, attestation verified on-chain.
   *  "enclave-sim" = simulated TEE (honestly NOT hardware-attested).
   *  "enclave" = generic attested SGX/TDX. "plain-server" = no isolation. */
  workerIsolation: "enclave" | "enclave-nautilus" | "enclave-sim" | "plain-server";
  simQuote?: SimulatedQuoteInfo;
  simVerified?: boolean;
  /** enclave-nautilus: on-chain Enclave object id used for verification. */
  enclaveObjectId?: `0x${string}`;
  /** enclave-nautilus: tx digest where reef::registry verified the enclave sig. */
  attestationTx?: `0x${string}`;
  /** enclave-nautilus: hex of the enclave's ed25519 signature over the result. */
  enclaveSig?: `0x${string}`;
}

export interface ComputeJobResult {
  status: ComputeJob["status"];
  /** Aggregate metrics — never raw rows. Present on a "done" run. */
  metrics?: Record<string, number>;
  /** The result registered as a derivative of the dataset (royalties upstream). */
  resultIpId?: `0x${string}`;
  /** Off-chain pointer to the metrics blob, if any. */
  metricsURI?: string;
  /** Why a job was rejected (e.g. off-allowlist algorithm). */
  reason?: string;
  /**
   * Worker isolation disclosure. For this demo: "plain-server (operator-trusted,
   * demo)" — the operator can see plaintext in memory. Production would attest an
   * SGX/TDX enclave. Seal does gated key-delivery only; it is NOT the privacy boundary.
   */
  isolationMode?: string;
  /** Provably false on a rejection: no decryption happened. */
  decryptCalled?: boolean;
  /** Tx hash for the derivative registration, when available. */
  resultTx?: `0x${string}`;
  /** True once the worker has zeroed the decrypted plaintext + scratch buffers. */
  scratchCleared?: boolean;
  /** Compute license token the worker minted to unlock the vault (decimal string). */
  licenseTokenId?: string;
  /** Non-fatal warning surfaced from a best-effort step (e.g. derivative reg). */
  warning?: string;
  attestation?: AttestationInfo;
}
