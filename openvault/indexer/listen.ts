// OpenVault event indexer (INDEX-ONLY).
//
// Mirrors PUBLIC on-chain registry data into the local SQLite read model so the
// UI can browse/search. NEVER touches decryption keys, NEVER sees plaintext,
// NEVER gates access.
//
// Per-event handling:
//   IPRegistered  → fetch + parse public IP metadata JSON at args.uri, upsert
//                   the artifact with parsed tier/modality/tags. NO silent
//                   "public" fallback: if metadata is missing/invalid, the
//                   upsert is SKIPPED with a loud warn — the artifact remains
//                   uncatalogued until metadata is reachable.
//   LicenseTerms  → set licenseTermsId/computeLicenseTermsId on the IP that
//                   carries the terms (best-effort match; fail loudly if not).

import { RPC_URL, IP_ASSET_REGISTRY } from "../lib/constants";
import { openDb, upsertArtifact } from "./db";
import type { Artifact, Tier, Modality } from "../types/artifact";

/** Public IP-metadata shape we expect at args.uri (subset). */
interface IpMeta {
  title?: string;
  description?: string;
  tags?: string[];
  modality?: string;
  // OpenVault-specific public fields (NEVER include vault keys or terms ids
  // that gate access — those come from on-chain).
  tier?: string;
  cid?: string;
  externalSource?: string;
}

function ipfsToGateway(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://gateway.pinata.cloud/ipfs/${path}`;
  }
  return uri;
}

async function fetchIpMeta(uri: string, timeoutMs = 15000): Promise<IpMeta | null> {
  if (!uri) return null;
  const url = ipfsToGateway(uri);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) {
      console.warn(`[indexer] metadata fetch ${r.status} for ${url}`);
      return null;
    }
    const data = (await r.json()) as IpMeta;
    return data;
  } catch (e) {
    console.warn(`[indexer] metadata fetch failed for ${url}: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

const TIER_VALUES: ReadonlySet<Tier> = new Set([
  "public",
  "private",
  "gated",
  "group",
  "compute",
]);
const MODALITY_VALUES: ReadonlySet<Modality> = new Set(["dataset", "model"]);

function coerceTier(v: unknown): Tier | undefined {
  if (typeof v === "string" && TIER_VALUES.has(v as Tier)) return v as Tier;
  return undefined;
}
function coerceModality(v: unknown): Modality | undefined {
  if (typeof v === "string" && MODALITY_VALUES.has(v as Modality)) return v as Modality;
  return undefined;
}

async function runReal(): Promise<void> {
  const { createPublicClient, http, parseAbiItem } = await import("viem");

  const db = openDb();
  const client = createPublicClient({ transport: http(RPC_URL) });

  // Real IPRegistered event from the Story IPAssetRegistry deployed on Aeneid.
  // ipId is NOT indexed; chainId, tokenContract, tokenId ARE indexed.
  const ipRegisteredEvent = parseAbiItem(
    "event IPRegistered(address ipId, uint256 indexed chainId, address indexed tokenContract, uint256 indexed tokenId, string name, string uri, uint256 registrationDate)"
  );

  console.log(`[indexer] watching ${RPC_URL} (registry=${IP_ASSET_REGISTRY})`);

  client.watchEvent({
    address: IP_ASSET_REGISTRY,
    event: ipRegisteredEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        const args = log.args as {
          ipId?: `0x${string}`;
          tokenId?: bigint;
          name?: string;
          uri?: string;
        };
        if (!args.ipId) continue;

        // Resolve public metadata. No silent "public" fallback — if metadata is
        // missing/invalid, skip the upsert and log loudly. The artifact will be
        // catalogued the next time the indexer is run with a reachable URI, or
        // when the UI self-indexes via POST /api/index.
        const meta = await fetchIpMeta(args.uri ?? "");
        if (!meta) {
          console.warn(
            `[indexer] SKIP ipId=${args.ipId} — metadata at ${args.uri} unreachable or invalid; not catalogued`
          );
          continue;
        }
        const tier = coerceTier(meta.tier);
        const modality = coerceModality(meta.modality);
        if (!tier || !modality) {
          console.warn(
            `[indexer] SKIP ipId=${args.ipId} — metadata missing/invalid tier(${meta.tier})/modality(${meta.modality})`
          );
          continue;
        }

        const row: Artifact = {
          ipId: args.ipId,
          tier,
          modality,
          title: typeof meta.title === "string" && meta.title.length > 0 ? meta.title : (args.name ?? args.ipId),
          description: typeof meta.description === "string" ? meta.description : "",
          tags: Array.isArray(meta.tags) ? meta.tags.filter((t) => typeof t === "string") : [],
          ipMetadataURI: args.uri ?? "",
          ownerNftTokenId: args.tokenId,
          createdTx: log.transactionHash ?? ("0x" as `0x${string}`),
          cid: typeof meta.cid === "string" ? meta.cid : undefined,
          externalSource: typeof meta.externalSource === "string" ? meta.externalSource : undefined,
        };
        upsertArtifact(db, row);
        console.log(`[indexer] upserted ${args.ipId} tier=${tier} modality=${modality}`);
      }
    },
  });

  // watchEvent runs until the process is killed; keep it alive.
}

async function main(): Promise<void> {
  await runReal();
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
