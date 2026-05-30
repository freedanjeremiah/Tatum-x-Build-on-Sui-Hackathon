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
  // timeout 180s + no retries: the user may sit on MetaMask's Blockaid "Review
  // alert" gate for a while before confirming; the default wallet timeout aborts
  // too early and surfaces as "Wallet timeout".
  const walletClient = createWalletClient({
    account: address,
    chain: aeneid,
    transport: custom(provider, { timeout: 180_000, retryCount: 0 }),
  });

  // Ensure the connected wallet is on Aeneid (1315) before any write, so txs
  // broadcast to the right chain. Without this, a wallet left on another network
  // makes the SDK's contract reads (e.g. publicMinting()) hit a chain where the
  // contract has no code and return "0x".
  try {
    if ((await walletClient.getChainId()) !== aeneid.id) {
      await walletClient.switchChain({ id: aeneid.id });
    }
  } catch {
    try {
      await walletClient.addChain({ chain: aeneid });
      await walletClient.switchChain({ id: aeneid.id });
    } catch {
      throw new Error(`Switch your wallet to Story Aeneid (chain ${aeneid.id}) and retry.`);
    }
  }

  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL } as any);
  // Reads use the dedicated Aeneid RPC (transport); writes are signed by the
  // wallet. Separating them means SDK contract reads never depend on whatever
  // network the wallet happens to have selected.
  const realStory = StoryClient.newClient({ transport: http(RPC_URL), wallet: walletClient, chainId: "aeneid" } as any);
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
