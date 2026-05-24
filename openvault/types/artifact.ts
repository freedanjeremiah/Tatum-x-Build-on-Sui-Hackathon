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
