// OpenVault event indexer (INDEX-ONLY).
//
// This script mirrors PUBLIC on-chain / registry data into the local SQLite
// read model so the UI can browse/search. It NEVER touches decryption keys,
// NEVER sees plaintext, and NEVER gates access.
//
//   Real:  watches Story Aeneid registry events via viem and upserts.

import { RPC_URL } from "../lib/constants";
import { openDb, upsertArtifact } from "./db";

async function runReal(): Promise<void> {
  const { createPublicClient, http, parseAbiItem } = await import("viem");
  const {
    // Real deployed Aeneid addresses (chain 1315).
    IP_ASSET_REGISTRY,
    LICENSE_TOKEN,
    ROYALTY_MODULE,
  } = await import("../lib/constants");

  const db = openDb();
  const client = createPublicClient({ transport: http(RPC_URL) });

  // Real IPRegistered event from the Story IPAssetRegistry deployed on Aeneid.
  // ipId is NOT indexed; chainId, tokenContract, tokenId ARE indexed.
  const ipRegisteredEvent = parseAbiItem(
    "event IPRegistered(address ipId, uint256 indexed chainId, address indexed tokenContract, uint256 indexed tokenId, string name, string uri, uint256 registrationDate)"
  );

  console.log(`[indexer] watching ${RPC_URL} (registry=${IP_ASSET_REGISTRY})`);

  // Watch IP registrations → upsert a public artifact shell. Off-chain public
  // metadata (title/description/tags) is resolved from the IP metadata URI.
  client.watchEvent({
    address: IP_ASSET_REGISTRY,
    event: ipRegisteredEvent,
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as {
          ipId?: `0x${string}`;
          tokenId?: bigint;
          name?: string;
          uri?: string;
        };
        if (!args.ipId) continue;
        // Index-only: never decrypt, never fetch secrets.
        // TODO: fetch + parse public metadata JSON at args.uri to populate
        // tier/modality/tags once the metadata schema is stable.
        upsertArtifact(db, {
          ipId: args.ipId,
          tier: "public",
          modality: "dataset",
          title: args.name ?? args.ipId,
          description: "",
          tags: [],
          ipMetadataURI: args.uri ?? "",
          ownerNftTokenId: args.tokenId,
          createdTx: log.transactionHash ?? ("0x" as `0x${string}`),
        });
        console.log(`[indexer] upserted ${args.ipId}`);
      }
    },
  });

  // TODO(real): also watch LicenseRegistry + RoyaltyModule to enrich license/royalty fields.
  void LICENSE_TOKEN;
  void ROYALTY_MODULE;

  // watchEvent runs until the process is killed; keep it alive.
}

async function main(): Promise<void> {
  await runReal();
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
