// SPEC §8.1 — Gated upload proof.
//
// Flow: register the IP Asset (with a commercial-remix license) FIRST so we have
// an ipId, then upload the (encrypted) weights to the CDR vault with a
// LICENSE_READ_CONDITION keyed to that ipId. The proven logic now lives in
// lib/artifacts.uploadGated; this script just exercises it.
//
// Run: pnpm real scripts/01-upload-gated.ts

import { getClients, logTx, saveLast } from "./_util";
import { uploadGated } from "../lib/artifacts";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  const content = new TextEncoder().encode("fake weights for SentimentLLM-7B");
  const art = await uploadGated(clients as any, {
    bytes: content,
    meta: {
      title: "SentimentLLM-7B",
      description:
        "7B-parameter sentiment model. Weights decrypt only for valid license-token holders.",
      tags: ["llm", "sentiment", "nlp", "gated"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });

  // Persist ids for the download script.
  saveLast({
    ipId: art.ipId,
    uuid: art.vaultUuid,
    cid: art.cid,
    licenseTermsId: art.licenseTermsId,
    tier: "gated",
  });

  console.log("=== 01-upload-gated (SPEC §8.1) ===");
  console.log("ipId:", art.ipId);
  console.log("licenseTermsId:", art.licenseTermsId);
  console.log("uuid:", art.vaultUuid);
  console.log("cid:", art.cid);
  logTx("register IP", art.createdTx);
  console.log("✓ gated artifact registered + uploaded (read-gated by license token)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
