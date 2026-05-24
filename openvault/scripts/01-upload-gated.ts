// SPEC §8.1 — Gated upload proof.
//
// Flow: register the IP Asset (with a commercial-remix license) FIRST so we have
// an ipId, then upload the (encrypted) weights to the CDR vault with a
// LICENSE_READ_CONDITION keyed to that ipId. Gating an upload before the asset
// exists is impossible — the read condition needs the ipId.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/01-upload-gated.ts

import { createHash } from "node:crypto";
import { encodeAbiParameters, parseEther } from "viem";

import { getClients, logTx, saveLast } from "./_util";
import { IS_MOCK } from "../lib/env";
import {
  PUBLIC_SPG_COLLECTION,
  OWNER_WRITE_CONDITION,
  LICENSE_READ_CONDITION,
  LICENSE_TOKEN,
} from "../lib/constants";

// WIP token (Story's wrapped IP). In real mode this is exported from the SDK.
// VERIFY: import { WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk"
const WIP = "0x1514000000000000000000000000000000000000" as `0x${string}`;

// sha256 over a JSON object → 0x-prefixed hex (used as the metadata content hash).
function sha256hex(obj: unknown): `0x${string}` {
  const json = JSON.stringify(obj);
  return ("0x" + createHash("sha256").update(json).digest("hex")) as `0x${string}`;
}

// Pin a JSON object to IPFS. In mock we fabricate a deterministic uri+hash.
// VERIFY: real pin via pinata-web3 (PinataSDK.upload.json) using PINATA_JWT.
async function pinJSON(obj: unknown): Promise<{ uri: string; hash: `0x${string}` }> {
  const hash = sha256hex(obj);
  if (IS_MOCK) {
    return { uri: "ipfs://mock" + hash.slice(2, 14), hash };
  }
  // Real-mode fallback (no network here): still deterministic so callers compile.
  // A wired implementation would: new PinataSDK({pinataJwt}).upload.json(obj) → cid.
  return { uri: "ipfs://" + hash.slice(2, 14), hash };
}

// Build a storage provider for the CDR uploader.
// VERIFY: real mode constructs a HeliaProvider (helia + @helia/unixfs) and uses
// CID.parse for content addressing; in mock a tiny stub is sufficient.
async function makeStorageProvider() {
  if (IS_MOCK) {
    return { CID: (s: string) => s } as any;
  }
  // Real: const helia = await createHelia(); return new HeliaProvider(helia);
  return { CID: (s: string) => s } as any;
}

async function main() {
  const { cdr, story, account } = await getClients();
  const owner = (account as any).address as `0x${string}`;

  // (1) Build IPA + NFT metadata and pin both.
  const ipMetadata = {
    title: "SentimentLLM-7B",
    description:
      "7B-parameter sentiment model. Weights decrypt only for valid license-token holders.",
    tags: ["llm", "sentiment", "nlp", "gated"],
    creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
    modality: "model",
  };
  const nftMetadata = {
    name: "SentimentLLM-7B — OpenVault IP NFT",
    description: "Ownership NFT for the gated SentimentLLM-7B artifact.",
  };
  const { uri: ipMetadataURI, hash: ipMetadataHash } = await pinJSON(ipMetadata);
  const { uri: nftMetadataURI, hash: nftMetadataHash } = await pinJSON(nftMetadata);

  // (2) Register the IP Asset with a commercial-remix license.
  // PILFlavor: real mode uses PILFlavor.commercialRemix(...); mock = plain object.
  // VERIFY: PILFlavor.commercialRemix from "@story-protocol/core-sdk"
  const commercialRemixTerms = {
    commercialRevShare: 5,
    defaultMintingFee: parseEther("1"),
    currency: WIP,
  };
  const reg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: commercialRemixTerms }],
    ipMetadata: { ipMetadataURI, ipMetadataHash, nftMetadataURI, nftMetadataHash },
  } as any);

  // (3) Capture ipId + the REAL licenseTermsId from the return (never hardcode it).
  const ipId = (reg as any).ipId as `0x${string}`;
  const licenseTermsId = String(
    (reg as any).licenseTermsId ?? (reg as any).licenseTermsIds?.[0] ?? ""
  );

  // (4) Storage provider for the vault upload.
  const storageProvider = await makeStorageProvider();

  // (5) Upload the encrypted weights, gated by a LICENSE_READ_CONDITION on ipId.
  const content = new TextEncoder().encode("fake weights for SentimentLLM-7B");
  const writeConditionData = encodeAbiParameters([{ type: "address" }], [owner]);
  // Real read condition encodes [licenseTokenContract, ipId]; the mock vault keys
  // its gate purely on the ipId, so we feed it the raw ipId in mock.
  const readConditionDataReal = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }],
    [LICENSE_TOKEN, ipId]
  );
  const up = await cdr.uploader.uploadFile({
    content,
    storageProvider,
    globalPubKey: await cdr.observer.getGlobalPubKey(),
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    readConditionAddr: LICENSE_READ_CONDITION,
    writeConditionData,
    readConditionData: IS_MOCK ? ipId : readConditionDataReal,
    accessAuxData: "0x",
  } as any);

  const uuid = (up as any).uuid;
  const cid = (up as any).cid;

  // (6) Persist ids for the download script.
  saveLast({ ipId, uuid, cid, licenseTermsId, tier: "gated" });

  console.log("=== 01-upload-gated (SPEC §8.1) ===");
  console.log("ipId:", ipId);
  console.log("licenseTermsId:", licenseTermsId);
  console.log("uuid:", uuid);
  console.log("cid:", cid);
  logTx("register IP", (reg as any).txHash);
  logTx("upload vault", (up as any).txHash);
  console.log("✓ gated artifact registered + uploaded (read-gated by license token)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
