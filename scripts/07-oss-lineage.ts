// Addendum §A (OSS provenance) — register an upstream OSS model as a PUBLIC
// provenance parent, then a derivative of it.
//
// Honesty rule: when wrapping an OSS model we do NOT claim ownership. The
// provenance IP carries the external source URL, the true upstream license, and
// the original authors, and attaches ONLY attribution PIL terms (never
// commercial). The proven logic now lives in
// lib/artifacts.{registerProvenanceParent,registerDerivative}.
//
// Run: pnpm real scripts/07-oss-lineage.ts

import { getClients, logTx } from "./_util";
import { registerProvenanceParent, registerDerivative } from "../lib/artifacts";

async function main() {
  const clients = await getClients();
  const owner = (clients.account as any).address as `0x${string}`;

  const HF_URL = "https://huggingface.co/meta-llama/Llama-3-8B";

  // Provenance parent — external_source + attribution-only, no ownership claim.
  const prov = await registerProvenanceParent(clients as any, {
    externalSource: HF_URL,
    upstreamLicense: "llama-3-community",
    authors: ["Meta AI"],
    title: "Llama-3-8B (OSS provenance wrapper)",
  });
  logTx("register provenance parent", prov.createdTx);

  // Derivative of the provenance parent (a fine-tune we DO author).
  const child = await registerDerivative(clients as any, {
    parentIpId: prov.ipId,
    parentTermsId: prov.licenseTermsId,
    bytes: new TextEncoder().encode("fine-tuned support model weights"),
    meta: {
      title: "Llama-3-8B-Finetuned-Support",
      description: "A support-domain fine-tune of the OSS Llama-3-8B.",
      tags: ["llm", "finetune", "support"],
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: "model",
      externalSource: HF_URL,
    },
  });
  logTx("register derivative", child.createdTx);

  console.log("=== 07-oss-lineage (Addendum §A) ===");
  console.log("external_source:", HF_URL);
  console.log("provenance parent ipId:", prov.ipId);
  console.log("derivative ipId:", child.ipId);
  console.log("✓ metadata asserts no ownership (attribution-only, non-commercial)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
