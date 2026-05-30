// Story Aeneid testnet constants for OpenVault.

export const RPC_URL = "https://aeneid.storyrpc.io";
export const CDR_API_URL = "http://172.192.41.96:1317";

export const OWNER_WRITE_CONDITION =
  "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`;
export const LICENSE_READ_CONDITION =
  "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3" as `0x${string}`;
export const LICENSE_TOKEN =
  "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`;
export const ROYALTY_MODULE =
  "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`;
export const ROYALTY_POLICY_LAP =
  "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E" as `0x${string}`;
export const EVEN_SPLIT_GROUP_POOL =
  "0xf96f2c30b41Cb6e0290de43C8528ae83d4f33F89" as `0x${string}`;
// SPGNFT collection uploads mint from (public minting enabled). Created via
// scripts/00-create-collection.ts on Aeneid; verified publicMinting()==true.
export const PUBLIC_SPG_COLLECTION =
  "0x0a26682c8E6e8eAe0b6F643C8Df4aE6aaf2791A6" as `0x${string}`;
export const IP_ASSET_REGISTRY =
  "0x77319B4031e6eF1250907aa00018B8B1c67a244b" as `0x${string}`;

// --- OpenVault custom CDR read-condition contracts (deployed on Aeneid) --------
// Authored in `contracts/`, deployed via `scripts/contracts/deploy.mjs`. These
// turn our two disclosed fallbacks into real on-chain enforcement and are the
// CDR-hackathon "advanced / composable read conditions" deliverable.
//
// AnyOf: OR-composer over sub-conditions. Group: one license for ANY group member
// unlocks every member vault (composes LICENSE_READ_CONDITION, resolves §8.7).
// ComputeWorker: vault readable ONLY by an allowlisted compute-worker operator —
// consumers can never decrypt (real "computable, not downloadable", §C4/§C9).
export const ANY_OF_READ_CONDITION =
  "0x97820c14c861d8be1fc7b17a4cb5335312383c8a" as `0x${string}`;
export const GROUP_LICENSE_READ_CONDITION =
  "0x58fbf091fedfe898465c1fbef7588a3f7e7128df" as `0x${string}`;
export const COMPUTE_WORKER_READ_CONDITION =
  "0x834c06ba613481401df4972a746ddd529b97b5c2" as `0x${string}`;

// The confidential-compute worker operator(s) allowed to decrypt compute-tier
// vaults. The server signer (WALLET_PRIVATE_KEY) address. Consumers are NOT here,
// so a consumer's vault read reverts — compute results only, never raw rows.
export const COMPUTE_WORKER_OPERATOR =
  "0x29bCb9811A60434514c245629DCE2FE4843E3C50" as `0x${string}`;

export const EXPLORER_IPA = "https://aeneid.explorer.story.foundation/ipa/";
export const STORYSCAN_TX = "https://aeneid.storyscan.io/tx/";

// Auto-wrap native IP -> WIP (and auto-approve) for any fee-bearing call. Fees
// (minting fee, royalties, dispute bonds) are denominated in WIP, but wallets
// hold native IP. With this, the SDK wraps exactly the shortfall in the same
// multicall and approves spending — caller never pre-wraps, so native IP is left
// for gas. Defaults are already true in core-sdk 1.4.4; set explicitly so the
// behavior survives SDK default changes. Nested under `options` per WithWipOptions.
export const WIP_OPTIONS = {
  options: { wipOptions: { enableAutoWrapIp: true, enableAutoApprove: true } },
} as const;
