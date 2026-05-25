// SPEC §8.2 (public) + §8.3 (private) — tier proofs.
//
// PUBLIC: register an attribution-only IP, hold the file in the clear, anyone
//   reads it (no token).
// PRIVATE: allocate + encrypt-write to the vault with OWNER-only conditions; the
//   owner decrypts; any other wallet is reverted.
// The proven logic now lives in lib/artifacts.{uploadPublic,uploadPrivate}.
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/06-public-private.ts

import { getClients, logTx } from "./_util";
import { IS_MOCK } from "../lib/env";
import { uploadPublic, uploadPrivate } from "../lib/artifacts";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;
  const { cdr } = clients as any;

  console.log("=== 06-public-private (SPEC §8.2, §8.3) ===");

  // ---------------- PUBLIC (§8.2) ----------------
  const publicBytes = new TextEncoder().encode("public weather rows, free to all");
  const pub = await uploadPublic(clients as any, {
    bytes: publicBytes,
    meta: {
      title: "OpenWeather Hourly",
      description: "Hourly weather observations, free to all.",
      tags: ["weather", "dataset", "public"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
  });
  // "Pin the file in clear" — the bytes are addressable by anyone (cid set, no vault).
  const publicReadOk = !pub.vaultUuid && !!pub.cid;
  logTx("register public IP", pub.createdTx);
  console.log(publicReadOk ? "✓ public-read-ok (no token required)" : "✗ public read failed");

  // ---------------- PRIVATE (§8.3) ----------------
  const secret = new TextEncoder().encode("proprietary fraud weights");
  const prv = await uploadPrivate(clients as any, {
    bytes: secret,
    meta: {
      title: "FraudNet-v3 (Private)",
      description: "Proprietary fraud model, owner-only.",
      tags: ["fraud", "model", "private"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });
  logTx("register private IP", prv.createdTx);

  // Owner read: owner satisfies the EOA read condition (mock: __mintFor(owner)).
  const ownerAux = IS_MOCK
    ? await cdr.__mintFor(owner)
    : (await import("viem")).encodeAbiParameters([{ type: "address" }], [owner]);
  const ownerOut = await cdr.consumer.downloadFile({ uuid: prv.vaultUuid, accessAuxData: ownerAux });
  const ownerText = new TextDecoder().decode(ownerOut.content);
  console.log(
    ownerText === "proprietary fraud weights"
      ? "✓ private-owner-ok (owner decrypts)"
      : "✗ private owner read failed"
  );

  // Second wallet read: a different address presents a non-matching token → revert.
  const otherAux = IS_MOCK
    ? "mocktoken-not-the-owner"
    : (await import("viem")).encodeAbiParameters(
        [{ type: "address" }],
        ["0x000000000000000000000000000000000000bEEF"]
      );
  let reverted = false;
  try {
    await cdr.consumer.downloadFile({ uuid: prv.vaultUuid, accessAuxData: otherAux });
  } catch {
    reverted = true;
  }
  if (!reverted) throw new Error("expected private read by a non-owner to revert");
  console.log("✓ private-other-reverts (non-owner cannot decrypt)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
