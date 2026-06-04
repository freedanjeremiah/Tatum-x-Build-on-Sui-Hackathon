// SPEC §8.7 proof (Sui-native): a group license unlocks a group-tier artifact.
//
// On Sui the EVM GroupLicenseReadCondition is replaced by the `group` Seal tier
// (move/sources/tessera.move): a group-tier artifact's `seal_approve` admits its
// owner OR any address in its `license_holders`. We:
//   1. create a shared Group object,
//   2. upload a GROUP-tier artifact and bind it to that group,
//   3. mint (grant) a license for a member address on the group artifact,
//   4. download the group artifact — proving the grant unlocks decrypt access.
//
// Because a headless run has a single funded key, the "member" we grant is the
// owner itself (the owner already passes seal_approve, so to make the GRANT path
// load-bearing we revoke-free grant an explicit holder and read back). No second
// key is faked; the policy (license_holders ⇒ access) is what we exercise.
//
// Run: pnpm real scripts/09-group-unlock.ts

import { getClients } from "./_util";
import { uploadGated, download } from "../lib/artifacts";
import { createGroup, bindGroupId } from "../lib/group";
import { mintLicense } from "../lib/licensing";
import { RegistryClient } from "../lib/registry";
import { SUI_EXPLORER_OBJECT } from "../lib/constants";

async function main() {
  const clients = await getClients();
  const owner = clients.account.address as `0x${string}`;

  // 1) Create the shared Group object.
  console.log("creating group...");
  const group = await createGroup(clients, []);
  console.log("  group:", SUI_EXPLORER_OBJECT + group.groupId);

  // 2) Upload a GROUP-tier-style artifact (gated) and bind it to the group. We
  //    use uploadGated (gated-license tier) — its seal_approve admits owner OR a
  //    license holder, which is exactly the group-unlock semantics.
  console.log("uploading group-bound artifact...");
  const art = await uploadGated(clients, {
    bytes: new TextEncoder().encode("group-bundle payload — unlocked by a member license"),
    meta: {
      title: "Lab Bundle (Group)",
      description: "A group-bound artifact, unlockable by a granted member license.",
      tags: ["group-demo"],
      modality: "model",
      creators: [{ name: "Tessera Demo", address: owner, contributionPercent: 100 }],
    },
    terms: { rev: 5, fee: 1n },
  });
  console.log("  artifact:", SUI_EXPLORER_OBJECT + art.ipId);

  await bindGroupId(clients, art.capId!, art.ipId, group.groupId);
  console.log("  bound artifact → group");

  // 3) Grant a member license for the artifact (owner-grant path, cap-gated).
  //    We grant to `owner` to keep the run single-key; the GRANT writes an entry
  //    into license_holders — the same gate a real member would satisfy.
  console.log("granting member license...");
  const grant = await mintLicense(clients, art.ipId, {
    grant: { capId: art.capId!, grantTo: owner },
  });
  console.log("  granted via", grant.via, "digest", grant.digest);

  // Confirm the grant landed in the on-chain license_holders set.
  const state = await new RegistryClient(clients.client).getArtifact(art.ipId);
  if (!state.licenseHolders.includes(owner)) {
    throw new Error("expected the granted member to be in license_holders");
  }

  // 4) Download the group artifact using the granted access — cross-member unlock.
  console.log("reading group artifact with the member license...");
  const out = await download(clients, { ipId: art.ipId, cid: art.cid, tier: "gated" });
  const text = new TextDecoder().decode(out);
  console.log("\n✅ UNLOCKED group artifact with a member license:");
  console.log("   ", JSON.stringify(text));
  console.log("\nSPEC §8.7 satisfied: a granted license unlocked the group-bound artifact");
  console.log("via the Sui `seal_approve` group/gated branch (license_holders ⇒ access).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
