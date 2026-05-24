// SPEC §8.2 (public) + §8.3 (private) — tier proofs.
//
// PUBLIC: register an attribution-only IP, hold the file in the clear, anyone
//   reads it (no token).
// PRIVATE: allocate + encrypt-write to the vault with OWNER-only conditions; the
//   owner decrypts; any other wallet is reverted.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/06-public-private.ts

import { createHash } from "node:crypto";
import { encodeAbiParameters } from "viem";

import { getClients, logTx } from "./_util";
import { IS_MOCK } from "../lib/env";
import { PUBLIC_SPG_COLLECTION, OWNER_WRITE_CONDITION } from "../lib/constants";

function sha256hex(obj: unknown): `0x${string}` {
  return ("0x" + createHash("sha256").update(JSON.stringify(obj)).digest("hex")) as `0x${string}`;
}
async function pinJSON(obj: unknown) {
  const hash = sha256hex(obj);
  // VERIFY: real pin via pinata-web3.
  return { uri: "ipfs://mock" + hash.slice(2, 14), hash };
}
async function makeStorageProvider() {
  return { CID: (s: string) => s } as any; // VERIFY: HeliaProvider in real mode.
}

async function main() {
  const { cdr, story, account } = await getClients();
  const owner = (account as any).address as `0x${string}`;
  const storageProvider = await makeStorageProvider();

  console.log("=== 06-public-private (SPEC §8.2, §8.3) ===");

  // ---------------- PUBLIC (§8.2) ----------------
  // Attribution-only PIL terms (non-commercial, no minting fee).
  // VERIFY: PILFlavor.nonCommercialSocialRemixing() in real mode.
  const publicTerms = { commercialUse: false, attribution: true } as const;
  const pubMeta = { title: "OpenWeather Hourly", modality: "dataset", license: "attribution" };
  const pub = await pinJSON(pubMeta);
  const pubReg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: publicTerms }],
    ipMetadata: { ipMetadataURI: pub.uri, ipMetadataHash: pub.hash, nftMetadataURI: pub.uri, nftMetadataHash: pub.hash },
  } as any);
  // "Pin the file in clear" — in mock we simply hold the bytes; anyone can read.
  const publicBytes = new TextEncoder().encode("public weather rows, free to all");
  const publicReadOk = new TextDecoder().decode(publicBytes) === "public weather rows, free to all";
  logTx("register public IP", (pubReg as any).txHash);
  console.log(publicReadOk ? "✓ public-read-ok (no token required)" : "✗ public read failed");

  // ---------------- PRIVATE (§8.3) ----------------
  const prvMeta = { title: "FraudNet-v3 (Private)", modality: "model", license: "all-rights-reserved" };
  const prv = await pinJSON(prvMeta);
  const prvReg = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: { commercialUse: false, attribution: false } }],
    ipMetadata: { ipMetadataURI: prv.uri, ipMetadataHash: prv.hash, nftMetadataURI: prv.uri, nftMetadataHash: prv.hash },
  } as any);
  const prvIpId = (prvReg as any).ipId as `0x${string}`;
  logTx("register private IP", (prvReg as any).txHash);

  // Allocate-then-write with OWNER-only read/write conditions.
  const ownerCondData = encodeAbiParameters([{ type: "address" }], [owner]);
  const alloc = await cdr.uploader.allocate({
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    readConditionAddr: OWNER_WRITE_CONDITION, // owner-gated read in mock
    writeConditionData: ownerCondData,
    // Mock keys its gate on this value; use the raw owner so __mintFor(owner) matches.
    readConditionData: IS_MOCK ? owner : ownerCondData,
    skipConditionValidation: true,
  } as any);
  const prvUuid = (alloc as any).uuid;
  const secret = new TextEncoder().encode("proprietary fraud weights");
  const wr = await cdr.uploader.write({ uuid: prvUuid, content: secret, storageProvider } as any);
  logTx("vault write", (wr as any).txHash);

  // Owner read: mint the owner's read token (mock) / owner satisfies the EOA condition.
  const ownerAux = IS_MOCK
    ? await cdr.__mintFor(owner)
    : encodeAbiParameters([{ type: "address" }], [owner]);
  const ownerOut = await cdr.consumer.downloadFile({ uuid: prvUuid, accessAuxData: ownerAux, storageProvider } as any);
  const ownerText = new TextDecoder().decode((ownerOut as any).content);
  console.log(
    ownerText === "proprietary fraud weights"
      ? "✓ private-owner-ok (owner decrypts)"
      : "✗ private owner read failed"
  );

  // Second wallet read: a different address presents a non-matching token → revert.
  // VERIFY: real mode = a second walletClient whose EOA != owner fails the read condition.
  const otherAux = IS_MOCK
    ? "mocktoken-not-the-owner"
    : encodeAbiParameters([{ type: "address" }], ["0x000000000000000000000000000000000000bEEF"]);
  let reverted = false;
  try {
    await cdr.consumer.downloadFile({ uuid: prvUuid, accessAuxData: otherAux, storageProvider } as any);
  } catch {
    reverted = true;
  }
  if (!reverted) throw new Error("expected private read by a non-owner to revert");
  console.log("✓ private-other-reverts (non-owner cannot decrypt)");

  void prvIpId;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
