// Register the small regression model as a PUBLIC model IP asset — exercises the
// same lib/artifacts.uploadPublic path the UploadWizard uses in the browser.
//
// Run: pnpm real scripts/_upload-regression.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getClients, logTx, selfIndex } from "./_util";
import { uploadPublic } from "../lib/artifacts";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  const file = resolve(__dirname, "sample", "regression-model.json");
  const bytes = new Uint8Array(readFileSync(file));
  console.log(`=== register regression model (${bytes.length} bytes) ===`);
  console.log("owner:", owner);

  const res = await uploadPublic(clients as any, {
    bytes,
    meta: {
      title: "TinyOLS Regression v1",
      description:
        "A 417-byte ordinary-least-squares linear regression (2 features, R²≈0.9999). Portable JSON weights — predict y = intercept + w·x.",
      tags: ["regression", "model", "linear", "ols", "tiny"],
      creators: [
        { name: "Reef Demo", address: owner, contributionPercent: 100 },
      ],
      modality: "model",
    },
  });

  logTx("register public model IP", res.createdTx);
  console.log("ipId:", res.ipId);
  console.log("cid:", res.cid);
  await selfIndex(res as unknown as Record<string, unknown>);
  const ok = !res.vaultUuid && !!res.cid && !!res.ipId;
  console.log(ok ? "✓ public model registered + indexed" : "✗ registration incomplete");
}

main().catch((e) => {
  console.error("UPLOAD FAILED:", e?.shortMessage || e?.message || e);
  process.exit(1);
});
