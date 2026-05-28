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
export const PUBLIC_SPG_COLLECTION =
  "0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc" as `0x${string}`;

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
