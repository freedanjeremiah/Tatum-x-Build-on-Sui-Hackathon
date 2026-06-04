// One-time registry bootstrap / connectivity check (Sui-native).
//
// There is no shared NFT collection to pre-create: in Reef each artifact is its
// OWN shared `ArtifactRegistry` object (move/sources/reef.move), minted directly
// by `register(...)`. This script is kept (the package.json/demo references the
// numeric step ordering) as a bootstrap that verifies the published package id +
// signer are wired before the demo runs. It performs NO on-chain mutation.
//
// Run: pnpm real scripts/00-create-collection.ts

import { getClients } from "./_util";
import { RegistryClient } from "../lib/registry";
import { REEF_PACKAGE_ID, SUI_EXPLORER_OBJECT } from "../lib/constants";

async function main() {
  if (!REEF_PACKAGE_ID || REEF_PACKAGE_ID.trim() === "") {
    throw new Error(
      "REEF_PACKAGE_ID is unset. Publish the Move package and set " +
        "OV_REEF_PACKAGE_ID (or NEXT_PUBLIC_OV_REEF_PACKAGE_ID) before running the demo.",
    );
  }

  const clients = await getClients();
  const owner = clients.account.address as `0x${string}`;

  // Constructing the RegistryClient validates the package id is present; reading
  // the on-chain package object confirms the gateway + package are reachable.
  new RegistryClient(clients.client);
  const pkg = await clients.client.core.getObject({ objectId: REEF_PACKAGE_ID });

  console.log("=== 00-bootstrap (Sui registry) ===");
  console.log("signer address :", owner);
  console.log("reef package:", SUI_EXPLORER_OBJECT + REEF_PACKAGE_ID);
  console.log("package reachable:", Boolean((pkg as { object?: unknown }).object));
  console.log(
    "\nNo collection to create on Sui — each artifact is its own shared object,\n" +
      "minted directly by register(...). Bootstrap OK; proceed to 01-upload-gated.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
