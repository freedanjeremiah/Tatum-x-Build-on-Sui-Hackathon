// SPEC §8.7 proof: one license unlocks a whole group via our custom
// GroupLicenseReadCondition. Uploads a member IP (gated), uploads a SECOND vault
// gated by the GROUP condition over [memberIp], mints a license for the member,
// then reads the group-gated vault using that member license — cross-IP unlock.
//
// Run: pnpm real scripts/09-group-unlock.ts

import { encodeAbiParameters, parseEther } from "viem";
import { getClients } from "./_util";
import { uploadGated } from "../lib/artifacts";
import { groupReadCondition } from "../lib/group";
import { mintLicense, encodeAccessAuxData } from "../lib/licensing";
import { heliaProvider } from "../lib/storage";
import { OWNER_WRITE_CONDITION, EXPLORER_IPA } from "../lib/constants";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;
  const cdr = clients.cdr as any;

  // 1) A real member artifact (gated by its own license).
  console.log("uploading member artifact...");
  const member = await uploadGated(clients as any, {
    bytes: new TextEncoder().encode("member-A secret weights"),
    meta: {
      title: "Lab Model A",
      description: "A member of a group/lab bundle.",
      tags: ["group-demo"],
      modality: "model",
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
    },
    terms: { rev: 5, fee: 1n },
  });
  console.log("  member IP:", EXPLORER_IPA + member.ipId);
  console.log("  member licenseTermsId:", member.licenseTermsId);

  // 2) A second vault gated by the GROUP condition over [member.ipId]. A license
  //    for ANY listed member unlocks it.
  console.log("uploading GROUP-gated vault (unlockable by any member license)...");
  const gc = groupReadCondition([member.ipId]);
  const groupVault = await cdr.uploader.uploadFile({
    content: new TextEncoder().encode("group-bundle payload — unlocked by the family license"),
    storageProvider: await heliaProvider(),
    globalPubKey: await cdr.observer.getGlobalPubKey(),
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    readConditionAddr: gc.readConditionAddr,
    writeConditionData: encodeAbiParameters([{ type: "address" }], [owner]),
    readConditionData: gc.readConditionData,
    accessAuxData: "0x",
  });
  console.log("  group vault uuid:", groupVault.uuid, "cid:", groupVault.cid);

  // 3) Mint a license for the MEMBER (the "subscription").
  console.log("minting member license (the subscription)...");
  // 10 WIP cap — explicit ceiling. No silent default.
  const tokenId = await mintLicense(
    clients.story,
    member.ipId,
    member.licenseTermsId!,
    parseEther("10"),
  );
  console.log("  license token:", tokenId.toString());

  // 4) Read the GROUP vault using the MEMBER license — cross-IP unlock.
  console.log("reading group vault with the member license...");
  const out = await cdr.consumer.downloadFile({
    uuid: groupVault.uuid,
    accessAuxData: encodeAccessAuxData([tokenId]),
    storageProvider: await heliaProvider(),
    timeoutMs: 120000,
  });
  const text = new TextDecoder().decode(out.content as Uint8Array);
  console.log("\n✅ UNLOCKED group vault with a member license:");
  console.log("   ", JSON.stringify(text));
  console.log("\nSPEC §8.7 satisfied: one license unlocked a different IP's vault");
  console.log("via the custom GroupLicenseReadCondition (composes LicenseReadCondition).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
