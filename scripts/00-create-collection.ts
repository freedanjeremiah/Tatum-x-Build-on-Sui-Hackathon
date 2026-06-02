// One-time: create the public SPG NFT collection that uploads mint from.
// mintAndRegisterIpAssetWithPilTerms calls publicMinting() on this contract, so it
// MUST be a real SPGNFT collection with public minting enabled. Run once, then put
// the printed address into lib/constants.ts PUBLIC_SPG_COLLECTION.
//
// Run: pnpm real scripts/00-create-collection.ts

import { zeroAddress } from "viem";
import { getClients } from "./_util";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;
  console.log("creating SPG collection, owner:", owner);

  const res = await clients.story.nftClient.createNFTCollection({
    name: "OpenVault Artifacts",
    symbol: "OVAULT",
    isPublicMinting: true, // anyone can mint (uploads mint their own IP NFT)
    mintOpen: true,
    mintFeeRecipient: zeroAddress,
    contractURI: "",
  });

  console.log("txHash         :", res.txHash);
  console.log("spgNftContract :", res.spgNftContract);
  console.log("\n>>> set PUBLIC_SPG_COLLECTION in lib/constants.ts to:", res.spgNftContract);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
