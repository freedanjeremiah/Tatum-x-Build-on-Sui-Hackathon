// SPEC §8.5 — Derivative registration + royalty flow.
//
// Register a parent IP, register a derivative of it, pay royalties to the
// derivative, then confirm the parent has claimable revenue and claim it.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/03-derivative-royalty.ts

import { createHash } from "node:crypto";
import { parseEther, zeroAddress } from "viem";

import { getClients, logTx } from "./_util";
import { PUBLIC_SPG_COLLECTION, ROYALTY_POLICY_LAP } from "../lib/constants";

// VERIFY: import { WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk"
const WIP = "0x1514000000000000000000000000000000000000" as `0x${string}`;

function sha256hex(o: unknown): `0x${string}` {
  return ("0x" + createHash("sha256").update(JSON.stringify(o)).digest("hex")) as `0x${string}`;
}
async function pinJSON(o: unknown) {
  const hash = sha256hex(o);
  return { uri: "ipfs://mock" + hash.slice(2, 14), hash }; // VERIFY: pinata-web3
}

async function main() {
  const { story } = await getClients();

  // --- Parent IP (commercial-remix so a derivative can attach) ---
  const pMeta = { title: "BaseModel-7B", modality: "model" };
  const p = await pinJSON(pMeta);
  // VERIFY: PILFlavor.commercialRemix from core-sdk in real mode.
  const parent = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [
      { terms: { commercialRevShare: 10, defaultMintingFee: parseEther("1"), currency: WIP } },
    ],
    ipMetadata: { ipMetadataURI: p.uri, ipMetadataHash: p.hash, nftMetadataURI: p.uri, nftMetadataHash: p.hash },
  } as any);
  const PARENT = (parent as any).ipId as `0x${string}`;
  const PARENT_TERMS = String(
    (parent as any).licenseTermsId ?? (parent as any).licenseTermsIds?.[0]
  );
  logTx("register parent", (parent as any).txHash);

  // --- Derivative IP of the parent ---
  const cMeta = { title: "BaseModel-7B-Finetuned", modality: "model" };
  const c = await pinJSON(cMeta);
  const child = await story.ipAsset.registerDerivativeIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    derivData: { parentIpIds: [PARENT], licenseTermsIds: [PARENT_TERMS] },
    ipMetadata: { ipMetadataURI: c.uri, ipMetadataHash: c.hash, nftMetadataURI: c.uri, nftMetadataHash: c.hash },
  } as any);
  const CHILD = (child as any).ipId as `0x${string}`;
  logTx("register derivative", (child as any).txHash);

  // --- Pay royalties on behalf of the derivative ---
  const pay = await story.royalty.payRoyaltyOnBehalf({
    receiverIpId: CHILD,
    payerIpId: zeroAddress,
    token: WIP,
    amount: parseEther("2"),
  } as any);
  logTx("pay royalty", (pay as any).txHash);

  // --- Parent's claimable revenue must be > 0 ---
  const claimable = (await story.royalty.claimableRevenue({
    ipId: PARENT,
    claimer: PARENT,
    token: WIP,
  } as any)) as bigint;
  if (!(claimable > 0n)) throw new Error("expected parent claimable revenue > 0");

  // --- Claim all revenue flowing up from the child ---
  const claim = await story.royalty.claimAllRevenue({
    ancestorIpId: PARENT,
    claimer: PARENT,
    childIpIds: [CHILD],
    royaltyPolicies: [ROYALTY_POLICY_LAP],
    currencyTokens: [WIP],
  } as any);

  console.log("=== 03-derivative-royalty (SPEC §8.5) ===");
  console.log("parent ipId:", PARENT);
  console.log("child ipId:", CHILD);
  console.log("claimable revenue (wei):", claimable.toString());
  logTx("claim revenue", (claim as any).txHash);
  console.log("✓ derivative registered, royalties paid + claimed by parent");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
