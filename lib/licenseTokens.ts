// On-chain read helper for a wallet's Story license tokens.
//
// The LICENSE_TOKEN contract (0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC) is an
// ERC1967 proxy that delegates to Story's LicenseToken implementation, which is
// ERC-721 *Enumerable* (verified against @story-protocol/core-sdk's
// licenseTokenAbi: it exposes balanceOf, ownerOf, tokenOfOwnerByIndex,
// tokenByIndex, totalSupply). So the cheapest correct path is:
//   1. balanceOf(owner)            — how many tokens the wallet holds.
//   2. tokenOfOwnerByIndex(owner,i) — the i-th token id, for i in [0, balance).
//
// If the deployed proxy ever reverts on tokenOfOwnerByIndex (enumerable not
// active), we fall back to a BOUNDED log scan of recent Transfer(_, owner, id)
// events and confirm each with ownerOf — never the whole chain, never fabricated
// ids. Any RPC failure throws so the page can render an honest fallback.

import { RPC_URL, LICENSE_TOKEN } from "./constants";
import { aeneid } from "./chains";

// How many recent blocks the fallback log scan covers. Bounded so it never
// walks the whole chain; Aeneid ~2s blocks → ~50k blocks ≈ a day of history.
const LOG_SCAN_BLOCKS = 50_000n;
// Per-getLogs window. Many RPCs cap the block span of a single eth_getLogs call;
// we page through LOG_SCAN_BLOCKS in chunks of this size.
const LOG_SCAN_CHUNK = 10_000n;

// Minimal inline ABI — only the functions/events we call. Matches the
// LicenseToken implementation behind the proxy.
const LICENSE_TOKEN_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

export interface LicenseTokenList {
  tokens: Array<{ tokenId: string }>;
  /** true if the enumerable path (tokenOfOwnerByIndex) was used. */
  enumerable: boolean;
  /** true if the bounded Transfer-log fallback was used. */
  scanned: boolean;
}

/**
 * List the license token ids held by `owner`. Real on-chain reads only — never
 * fabricates ids. Throws on RPC failure so callers can show an honest fallback.
 */
export async function listLicenseTokens(
  owner: `0x${string}`,
): Promise<LicenseTokenList> {
  const { createPublicClient, http, getAddress } = await import("viem");
  const client = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });

  // 1) balanceOf — throws on RPC failure (propagated to caller).
  const balance = (await client.readContract({
    address: LICENSE_TOKEN,
    abi: LICENSE_TOKEN_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;

  if (balance === 0n) {
    return { tokens: [], enumerable: true, scanned: false };
  }

  // 2) Try the enumerable path: tokenOfOwnerByIndex for each index.
  try {
    const ids: Array<{ tokenId: string }> = [];
    for (let i = 0n; i < balance; i++) {
      const id = (await client.readContract({
        address: LICENSE_TOKEN,
        abi: LICENSE_TOKEN_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, i],
      })) as bigint;
      ids.push({ tokenId: id.toString() });
    }
    return { tokens: ids, enumerable: true, scanned: false };
  } catch {
    // Enumerable not active on this proxy — fall through to a bounded log scan.
  }

  // 3) Bounded fallback: scan recent Transfer(_, owner, id) logs, then confirm
  //    each id's current owner via ownerOf (a token may have moved on).
  const latest = await client.getBlockNumber();
  const fromFloor = latest > LOG_SCAN_BLOCKS ? latest - LOG_SCAN_BLOCKS : 0n;
  const transferEvent = LICENSE_TOKEN_ABI[3];
  const candidates = new Set<bigint>();

  for (let from = fromFloor; from <= latest; from += LOG_SCAN_CHUNK) {
    const to = from + LOG_SCAN_CHUNK - 1n > latest ? latest : from + LOG_SCAN_CHUNK - 1n;
    const logs = await client.getLogs({
      address: LICENSE_TOKEN,
      event: transferEvent,
      args: { to: owner },
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const id = (log.args as { tokenId?: bigint }).tokenId;
      if (id !== undefined) candidates.add(id);
    }
  }

  const ownerNorm = getAddress(owner);
  const held: Array<{ tokenId: string }> = [];
  for (const id of candidates) {
    try {
      const cur = (await client.readContract({
        address: LICENSE_TOKEN,
        abi: LICENSE_TOKEN_ABI,
        functionName: "ownerOf",
        args: [id],
      })) as `0x${string}`;
      if (getAddress(cur) === ownerNorm) held.push({ tokenId: id.toString() });
    } catch {
      // ownerOf reverts for burned tokens — skip, never fabricate.
    }
  }

  return { tokens: held, enumerable: false, scanned: true };
}
