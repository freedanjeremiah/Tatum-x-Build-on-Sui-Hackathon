// Returns real Story/CDR clients (real mode only).
// The real SDKs are dynamically imported so they are only loaded when needed.
//
// Real mode: viem clients are bound to the Story Aeneid chain (id 1315) so the
// wallet can sign + send txs; the Story client is wrapped by wrapStory so
// callers get the friendly `registerIpAsset` names with normalized returns.

import { RPC_URL, CDR_API_URL } from "./constants";
import { aeneid } from "./chains";
import { wrapStory } from "./storyAdapter";

// --- Script / server context (private key) ---
export async function makeClientsFromKey(pk: `0x${string}`) {
  if (!pk) throw new Error("Missing WALLET_PRIVATE_KEY — real mode requires a funded signer key");

  const { CDRClient, initWasm } = await import("@piplabs/cdr-sdk");
  const { StoryClient } = await import("@story-protocol/core-sdk");
  const { createPublicClient, createWalletClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  // CDR's TDH2 decrypt/encrypt runs in WASM (re-exported from @piplabs/cdr-crypto);
  // initialize it before any uploader/consumer call (idempotent).
  await initWasm();
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: aeneid, transport: http(RPC_URL) });
  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL } as any);
  const realStory = StoryClient.newClient({ transport: http(RPC_URL), account, chainId: "aeneid" } as any);
  const story = wrapStory(realStory);
  return { cdr, story, account, publicClient, walletClient };
}

// --- Browser context (wallet connector via EIP-1193 provider) ---
export async function makeClientsFromProvider(provider: any, address: `0x${string}`) {
  const { CDRClient, initWasm } = await import("@piplabs/cdr-sdk");
  const { StoryClient } = await import("@story-protocol/core-sdk");
  const { createPublicClient, createWalletClient, custom, http } = await import("viem");

  await initWasm();
  const publicClient = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: address, chain: aeneid, transport: custom(provider) });
  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL } as any);
  const realStory = StoryClient.newClient({ transport: custom(provider), account: address, chainId: "aeneid" } as any);
  const story = wrapStory(realStory);
  // Expose `account.address` to match makeClientsFromKey; consumers
  // (artifacts.ownerOf, UploadWizard, worker) all read clients.account.address.
  return { cdr, story, account: { address }, address, publicClient, walletClient };
}

// Read-only CDR (browse without wallet)
export async function makeReadOnlyCdr() {
  const { CDRClient } = await import("@piplabs/cdr-sdk");
  const { createPublicClient, http } = await import("viem");
  const publicClient = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });
  return new CDRClient({ network: "testnet", publicClient, apiUrl: CDR_API_URL } as any);
}
