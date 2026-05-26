// OpenVault event indexer (INDEX-ONLY).
//
// This script mirrors PUBLIC on-chain / registry data into the local SQLite
// read model so the UI can browse/search. It NEVER touches decryption keys,
// NEVER sees plaintext, and NEVER gates access.
//
//   Mock:  NEXT_PUBLIC_MOCK=1 pnpm indexer  → seeds the db from SEED_ARTIFACTS.
//   Real:  watches Story registry/license/royalty events via viem and upserts.

import { IS_MOCK } from "../lib/env";
import { RPC_URL } from "../lib/constants";
import { openDb, upsertArtifact } from "./db";
import { SEED_ARTIFACTS } from "../lib/mock/seed";

async function runMock(): Promise<void> {
  const db = openDb();
  for (const a of SEED_ARTIFACTS) {
    upsertArtifact(db, a);
    console.log(`[indexer:mock] indexed ${a.ipId} (${a.tier}/${a.modality}) "${a.title}"`);
  }
  db.close();
  console.log(`[indexer:mock] seeded ${SEED_ARTIFACTS.length} artifacts → indexer/openvault.db`);
}

async function runReal(): Promise<void> {
  // Real-mode listener. We have no RPC creds to exercise this in CI, so the
  // exact event ABIs/addresses are marked with VERIFY comments. The structure
  // compiles and is dependency-light: viem is imported dynamically so the mock
  // path never loads it.
  const { createPublicClient, http, parseAbiItem } = await import("viem");
  const {
    // VERIFY: confirm these address exports exist in lib/constants for the
    // contracts you actually want to index (IPAssetRegistry, LicenseRegistry,
    // RoyaltyModule). Some are present; add any that are missing.
    LICENSE_TOKEN,
    ROYALTY_MODULE,
  } = await import("../lib/constants");

  const db = openDb();
  const client = createPublicClient({ transport: http(RPC_URL) });

  // VERIFY: the real event signature emitted by the Story IP Asset Registry on
  // registration. Replace with the canonical ABI item from the deployed
  // contract. This placeholder lets us structure the watcher and keeps it typed.
  const ipRegisteredEvent = parseAbiItem(
    "event IPRegistered(address indexed ipId, uint256 indexed chainId, address tokenContract, uint256 tokenId, string name, string uri, uint256 registrationDate)"
  );

  // VERIFY: IPAssetRegistry deployment address on Aeneid (add to lib/constants).
  const IP_ASSET_REGISTRY = "0x0000000000000000000000000000000000000000" as `0x${string}`;

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
        // VERIFY: fetch + parse public metadata JSON at args.uri to populate
        // tier/modality/tags. Index-only: never decrypt, never fetch secrets.
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

  // VERIFY: also watch LicenseRegistry (license terms attached, license tokens
  // minted) at LICENSE_TOKEN and RoyaltyModule at ROYALTY_MODULE to enrich the
  // index with licenseTermsId / royalty info. Structured here as TODO watchers.
  void LICENSE_TOKEN;
  void ROYALTY_MODULE;

  // watchEvent runs until the process is killed; keep it alive.
}

async function main(): Promise<void> {
  if (IS_MOCK) {
    await runMock();
    process.exit(0);
  }
  await runReal();
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
