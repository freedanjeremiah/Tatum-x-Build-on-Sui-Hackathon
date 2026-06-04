// Gated upload proof.
//
// Flow: register the artifact (with a commercial-remix license) FIRST so we have
// an artifactId, then Seal-encrypt the weights bound to that id+tier and publish
// the ciphertext to Walrus. The seal_approve `gated` branch keys decryption to the
// artifact's license_holders. The proven logic lives in lib/artifacts.uploadGated;
// this script just exercises it.
//
// Run: pnpm real scripts/01-upload-gated.ts

import { getClients, logTx, saveLast, selfIndex } from "./_util";
import { uploadGated } from "../lib/artifacts";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  // Sample demo payload — really Seal-encrypted + stored on Walrus by uploadGated.
  const content = new TextEncoder().encode("sample weights for SentimentLLM-7B");
  const art = await uploadGated(clients as any, {
    bytes: content,
    meta: {
      title: "SentimentLLM-7B",
      description:
        "7B-parameter sentiment model. Weights decrypt only for valid license-token holders.",
      tags: ["llm", "sentiment", "nlp", "gated"],
      creators: [{ name: "Tessera Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
    // Explicit terms — no silent default. 5% rev-share, 1-wei nominal fee.
    terms: { rev: 5, fee: 1n },
  });

  // Persist ids for the download script.
  saveLast({
    ipId: art.ipId,
    uuid: art.vaultUuid,
    cid: art.cid,
    licenseTermsId: art.licenseTermsId,
    tier: "gated",
  });

  await selfIndex(art as unknown as Record<string, unknown>);

  console.log("=== 01-upload-gated ===");
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
