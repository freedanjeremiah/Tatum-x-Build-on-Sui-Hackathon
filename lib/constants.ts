// Story Aeneid testnet constants for Tessera.
//
// Every constant here is env-overrideable so the same code runs against a
// different network (e.g. Story mainnet, an alternative CDR endpoint, or a
// future fork) without code edits. Defaults preserve the Aeneid testnet
// behaviour the rest of the codebase was authored against.
//
// Naming: vars are read in this order for each constant:
//   1. NEXT_PUBLIC_OV_<NAME>   (works in client + server bundles)
//   2. OV_<NAME>               (server-only override)
//   3. Aeneid testnet default
// Browsers only see NEXT_PUBLIC_ vars; the server reads both.

function envStr(name: string, fallback: string): string {
  const fromPublic = process.env[`NEXT_PUBLIC_OV_${name}`];
  if (fromPublic && fromPublic.length > 0) return fromPublic;
  const fromServer = process.env[`OV_${name}`];
  if (fromServer && fromServer.length > 0) return fromServer;
  return fallback;
}

function envAddr(name: string, fallback: `0x${string}`): `0x${string}` {
  const v = envStr(name, fallback);
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) {
    throw new Error(
      `[constants] invalid address override for ${name}: ${v} — must be 0x + 40 hex chars`,
    );
  }
  return v as `0x${string}`;
}

export const RPC_URL: string = envStr("RPC_URL", "https://aeneid.storyrpc.io");
export const CDR_API_URL: string = envStr("CDR_API_URL", "http://172.192.41.96:1317");

export const OWNER_WRITE_CONDITION = envAddr(
  "OWNER_WRITE_CONDITION",
  "0x4C9bFC96d7092b590D497A191826C3dA2277c34B",
);
export const LICENSE_READ_CONDITION = envAddr(
  "LICENSE_READ_CONDITION",
  "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3",
);
export const LICENSE_TOKEN = envAddr(
  "LICENSE_TOKEN",
  "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC",
);
export const ROYALTY_MODULE = envAddr(
  "ROYALTY_MODULE",
  "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086",
);
export const ROYALTY_POLICY_LAP = envAddr(
  "ROYALTY_POLICY_LAP",
  "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E",
);
export const EVEN_SPLIT_GROUP_POOL = envAddr(
  "EVEN_SPLIT_GROUP_POOL",
  "0xf96f2c30b41Cb6e0290de43C8528ae83d4f33F89",
);
// SPGNFT collection uploads mint from (public minting enabled). Created via
// scripts/00-create-collection.ts on Aeneid; verified publicMinting()==true.
export const PUBLIC_SPG_COLLECTION = envAddr(
  "PUBLIC_SPG_COLLECTION",
  "0x0a26682c8E6e8eAe0b6F643C8Df4aE6aaf2791A6",
);
export const IP_ASSET_REGISTRY = envAddr(
  "IP_ASSET_REGISTRY",
  "0x77319B4031e6eF1250907aa00018B8B1c67a244b",
);

// --- Tessera custom CDR read-condition contracts (deployed on Aeneid) --------
// Authored in `contracts/`, deployed via `scripts/contracts/deploy.mjs`. These
// turn our two disclosed fallbacks into real on-chain enforcement and are the
// CDR-hackathon "advanced / composable read conditions" deliverable.
//
// AnyOf: OR-composer over sub-conditions. Group: one license for ANY group member
// unlocks every member vault (composes LICENSE_READ_CONDITION, resolves §8.7).
// ComputeWorker: vault readable ONLY by an allowlisted compute-worker operator —
// consumers can never decrypt (real "computable, not downloadable", §C4/§C9).
export const ANY_OF_READ_CONDITION = envAddr(
  "ANY_OF_READ_CONDITION",
  "0x97820c14c861d8be1fc7b17a4cb5335312383c8a",
);
export const GROUP_LICENSE_READ_CONDITION = envAddr(
  "GROUP_LICENSE_READ_CONDITION",
  "0x58fbf091fedfe898465c1fbef7588a3f7e7128df",
);
export const COMPUTE_WORKER_READ_CONDITION = envAddr(
  "COMPUTE_WORKER_READ_CONDITION",
  "0x834c06ba613481401df4972a746ddd529b97b5c2",
);
// Read-side counterpart to OWNER_WRITE_CONDITION (the latter only implements
// checkWriteCondition). Deployed via scripts/contracts/deploy.mjs alongside
// the other Tessera read conditions; without this, private-tier downloads
// revert at the CDR precompile.
export const OWNER_READ_CONDITION = envAddr(
  "OWNER_READ_CONDITION",
  "0xd5bfb61879f4a3f6983d9f4439489845e1b9c87f",
);

// The confidential-compute worker operator(s) allowed to decrypt compute-tier
// vaults. The server signer (WALLET_PRIVATE_KEY) address. Consumers are NOT here,
// so a consumer's vault read reverts — compute results only, never raw rows.
export const COMPUTE_WORKER_OPERATOR = envAddr(
  "COMPUTE_WORKER_OPERATOR",
  "0x29bCb9811A60434514c245629DCE2FE4843E3C50",
);

export const EXPLORER_IPA: string = envStr(
  "EXPLORER_IPA",
  "https://aeneid.explorer.story.foundation/ipa/",
);
export const STORYSCAN_TX: string = envStr(
  "STORYSCAN_TX",
  "https://aeneid.storyscan.io/tx/",
);

// Auto-wrap native IP -> WIP (and auto-approve) for any fee-bearing call. Fees
// (minting fee, royalties, dispute bonds) are denominated in WIP, but wallets
// hold native IP. With this, the SDK wraps exactly the shortfall in the same
// multicall and approves spending — caller never pre-wraps, so native IP is left
// for gas. Defaults are already true in core-sdk 1.4.4; set explicitly so the
// behavior survives SDK default changes. Nested under `options` per WithWipOptions.
export const WIP_OPTIONS = {
  options: { wipOptions: { enableAutoWrapIp: true, enableAutoApprove: true } },
} as const;
