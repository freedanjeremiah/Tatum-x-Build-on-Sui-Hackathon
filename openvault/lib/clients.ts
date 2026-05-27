// Returns real Story/CDR clients when keyed, deterministic mocks otherwise.
// The real SDKs are dynamically imported inside the non-mock branch so that in
// mock mode they are never loaded — the app (and tests) work even if the real
// SDK packages have runtime issues.

import { IS_MOCK } from "./env";
import { RPC_URL, CDR_API_URL } from "./constants";
import { makeMockClients } from "./mock/story";

// --- Script / server context (private key) ---
export async function makeClientsFromKey(pk: `0x${string}`) {
  if (IS_MOCK) return makeMockClients(pk);

  const { CDRClient, initWasm } = await import("@piplabs/cdr-sdk");
  const { StoryClient } = await import("@story-protocol/core-sdk");
  const { createPublicClient, createWalletClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  await initWasm();
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL } as any);
  const story = StoryClient.newClient({ transport: http(RPC_URL), account, chainId: "aeneid" } as any);
  return { cdr, story, account, publicClient, walletClient };
}

// --- Browser context (wallet connector via EIP-1193 provider) ---
export async function makeClientsFromProvider(provider: any, address: `0x${string}`) {
  if (IS_MOCK) return makeMockClients(address);

  const { CDRClient, initWasm } = await import("@piplabs/cdr-sdk");
  const { StoryClient } = await import("@story-protocol/core-sdk");
  const { createPublicClient, createWalletClient, custom, http } = await import("viem");

  await initWasm();
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: address, transport: custom(provider) });
  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL } as any);
  const story = StoryClient.newClient({ transport: custom(provider), account: address, chainId: "aeneid" } as any);
  // Expose `account.address` to match makeClientsFromKey + the mock; consumers
  // (artifacts.ownerOf, UploadWizard, worker) all read clients.account.address.
  return { cdr, story, account: { address }, address, publicClient, walletClient };
}

// Read-only CDR (browse without wallet)
export async function makeReadOnlyCdr() {
  if (IS_MOCK) return makeMockClients("readonly").cdr;

  const { CDRClient } = await import("@piplabs/cdr-sdk");
  const { createPublicClient, http } = await import("viem");
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  return new CDRClient({ network: "testnet", publicClient, apiUrl: CDR_API_URL } as any);
}
