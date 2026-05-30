export type Tier = "public" | "private" | "gated" | "group" | "compute";
export type Modality = "dataset" | "model";

export interface Artifact {
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
   * SGX/TDX enclave. CDR does key-delivery only; it is NOT the privacy boundary.
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
}
