// OpenVault event indexer (INDEX-ONLY).
//
// Mirrors PUBLIC on-chain registry data into the local SQLite read model so the
// UI can browse/search. NEVER touches decryption keys, NEVER sees plaintext,
// NEVER gates access.
//
// Watchers:
//   IPRegistered       → fetch + parse public IP metadata JSON at args.uri,
//                        upsert with parsed tier/modality/tags. NO silent
//                        public-shell fallback; missing/invalid metadata SKIPS
//                        the upsert with a loud warn.
//   LicenseTokenMinted → bump the licensor IP's score by a fee-weighted nudge
//                        so the leaderboard surfaces actively-licensed IPs.
//   RoyaltyPaid        → bump the receiver IP's score and the payer IP's score
//                        (real economic activity → real ranking signal).
//
// Deferred (need module addresses in constants.ts to wire properly):
//   GroupCreated / GroupIpsAdded — set groupId on the indexed members.
//   DisputeRaised / DisputeResolved — record dispute state on the targetIpId.
// These are noted in HANDOFF.md P1 as the next iteration.

import { RPC_URL, IP_ASSET_REGISTRY, LICENSE_TOKEN, ROYALTY_MODULE } from "../lib/constants";
import { openDb, upsertArtifact, getArtifact } from "./db";
import type { Artifact, Tier, Modality } from "../types/artifact";

/** Public IP-metadata shape we expect at args.uri (subset). */
interface IpMeta {
  title?: string;
  description?: string;
  tags?: string[];
  modality?: string;
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

  // --- IPAssetRegistry.IPRegistered ---
  // chainId, tokenContract, tokenId ARE indexed; ipId is NOT.
  const ipRegisteredEvent = parseAbiItem(
    "event IPRegistered(address ipId, uint256 indexed chainId, address indexed tokenContract, uint256 indexed tokenId, string name, string uri, uint256 registrationDate)"
  );

  console.log(
    `[indexer] watching ${RPC_URL} (ipRegistry=${IP_ASSET_REGISTRY}, licenseToken=${LICENSE_TOKEN}, royaltyModule=${ROYALTY_MODULE})`,
  );

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

        const meta = await fetchIpMeta(args.uri ?? "");
        if (!meta) {
          console.warn(
            `[indexer] SKIP ipId=${args.ipId} — metadata at ${args.uri} unreachable or invalid; not catalogued`,
          );
          continue;
        }
        const tier = coerceTier(meta.tier);
        const modality = coerceModality(meta.modality);
        if (!tier || !modality) {
          console.warn(
            `[indexer] SKIP ipId=${args.ipId} — metadata missing/invalid tier(${meta.tier})/modality(${meta.modality})`,
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

  // --- LicenseToken.LicenseTokenMinted ---
  // Bump the licensor IP's score on every mint. Story's canonical event:
  //   event LicenseTokenMinted(address indexed minter, address indexed receiver,
  //                            uint256 indexed startLicenseTokenId, uint256 amount,
  //                            address licensorIpId, uint256 licenseTermsId)
  // We index the licensorIpId regardless of mint amount — the count is what the
  // leaderboard cares about (not the magnitude of a single mint).
  const licenseTokenMinted = parseAbiItem(
    "event LicenseTokenMinted(address indexed minter, address indexed receiver, uint256 indexed startLicenseTokenId, uint256 amount, address licensorIpId, uint256 licenseTermsId)",
  );
  try {
    client.watchEvent({
      address: LICENSE_TOKEN,
      event: licenseTokenMinted,
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as {
            licensorIpId?: `0x${string}`;
            licenseTermsId?: bigint;
            amount?: bigint;
          };
          if (!args.licensorIpId) continue;
          const existing = getArtifact(db, args.licensorIpId);
          if (!existing) {
            console.warn(
              `[indexer] LicenseTokenMinted for unknown ipId=${args.licensorIpId} (not in index yet) — skipping score bump`,
            );
            continue;
          }
          existing.score = (existing.score ?? 0) + 2;
          if (!existing.licenseTermsId && args.licenseTermsId !== undefined) {
            existing.licenseTermsId = args.licenseTermsId.toString();
          }
          upsertArtifact(db, existing);
          console.log(
            `[indexer] LicenseTokenMinted licensor=${args.licensorIpId} +2 score`,
          );
        }
      },
    });
  } catch (e) {
    console.warn(`[indexer] could not watch LicenseTokenMinted: ${(e as Error).message}`);
  }

  // --- RoyaltyModule.RoyaltyPaid ---
  // Bump both receiver and payer. Receiver gets +3 (revenue is the strongest
  // economic signal), payer gets +1 (consuming downstream IP is a weaker signal
  // but still real activity). Story's event:
  //   event RoyaltyPaid(address indexed receiverIpId, address indexed payerIpId,
  //                     address indexed sender, address token, uint256 amount)
  const royaltyPaid = parseAbiItem(
    "event RoyaltyPaid(address indexed receiverIpId, address indexed payerIpId, address indexed sender, address token, uint256 amount)",
  );
  try {
    client.watchEvent({
      address: ROYALTY_MODULE,
      event: royaltyPaid,
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as {
            receiverIpId?: `0x${string}`;
            payerIpId?: `0x${string}`;
            amount?: bigint;
          };
          if (args.receiverIpId) {
            const r = getArtifact(db, args.receiverIpId);
            if (r) {
              r.score = (r.score ?? 0) + 3;
              upsertArtifact(db, r);
              console.log(
                `[indexer] RoyaltyPaid receiver=${args.receiverIpId} +3 score`,
              );
            } else {
              console.warn(
                `[indexer] RoyaltyPaid receiver unknown: ${args.receiverIpId}`,
              );
            }
          }
          if (args.payerIpId) {
            const p = getArtifact(db, args.payerIpId);
            if (p) {
              p.score = (p.score ?? 0) + 1;
              upsertArtifact(db, p);
            }
          }
        }
      },
    });
  } catch (e) {
    console.warn(`[indexer] could not watch RoyaltyPaid: ${(e as Error).message}`);
  }

  // watchEvent runs until the process is killed; keep it alive.
}

async function main(): Promise<void> {
  await runReal();
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
