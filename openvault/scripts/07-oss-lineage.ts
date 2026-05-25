// Addendum §A (OSS provenance) — register an upstream OSS model as a PUBLIC
// provenance parent, then a derivative of it.
//
// Honesty rule: when wrapping an OSS model we do NOT claim ownership. The
// provenance IP carries the external source URL, the true upstream license, and
// the original authors, and attaches ONLY attribution / non-commercial PIL terms
// (never commercial terms).
//
// Run: NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/07-oss-lineage.ts

import { createHash } from "node:crypto";

import { getClients, logTx } from "./_util";
import { PUBLIC_SPG_COLLECTION } from "../lib/constants";

function sha256hex(o: unknown): `0x${string}` {
  return ("0x" + createHash("sha256").update(JSON.stringify(o)).digest("hex")) as `0x${string}`;
}
async function pinJSON(o: unknown) {
  const hash = sha256hex(o);
  return { uri: "ipfs://mock" + hash.slice(2, 14), hash }; // VERIFY: pinata-web3
}

// Attribution / non-commercial PIL terms only — provenance never asserts commercial rights.
// VERIFY: PILFlavor.nonCommercialSocialRemixing() in real mode.
function isNonCommercial(terms: { commercialUse?: boolean }) {
  return terms.commercialUse === false;
}

async function main() {
  const { story } = await getClients();

  const HF_URL = "https://huggingface.co/meta-llama/Llama-3-8B";

  // Provenance metadata — MUST carry external_source, upstream license, authors,
  // and MUST NOT carry commercial terms.
  const provenanceTerms = { commercialUse: false, attribution: true } as const;
  if (!isNonCommercial(provenanceTerms)) {
    throw new Error("provenance terms must be non-commercial (no ownership claim)");
  }

  const provMeta = {
    title: "Llama-3-8B (OSS provenance wrapper)",
    description:
      "Provenance record for an external open-source model. Wrapper asserts no ownership.",
    modality: "model",
    external_source: HF_URL,
    upstreamLicense: "llama-3-community",
    originalAuthors: ["Meta AI"],
    ownershipClaim: "none — attribution-only provenance",
  };
  // Assert in code that the metadata reflects an external, attribution-only record.
  if (provMeta.external_source !== HF_URL) throw new Error("external_source must equal the HF URL");
  if (provMeta.upstreamLicense !== "llama-3-community") throw new Error("must record true upstream license");

  const prov = await pinJSON(provMeta);
  const parent = await story.ipAsset.registerIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    licenseTermsData: [{ terms: provenanceTerms }],
    ipMetadata: { ipMetadataURI: prov.uri, ipMetadataHash: prov.hash, nftMetadataURI: prov.uri, nftMetadataHash: prov.hash },
  } as any);
  const PROV = (parent as any).ipId as `0x${string}`;
  const PROV_TERMS = String((parent as any).licenseTermsId ?? (parent as any).licenseTermsIds?.[0]);
  logTx("register provenance parent", (parent as any).txHash);

  // Derivative of the provenance parent (e.g. a fine-tune we DO author).
  const derMeta = { title: "Llama-3-8B-Finetuned-Support", modality: "model", external_source: HF_URL };
  const der = await pinJSON(derMeta);
  const child = await story.ipAsset.registerDerivativeIpAsset({
    nft: { type: "mint", spgNftContract: PUBLIC_SPG_COLLECTION },
    derivData: { parentIpIds: [PROV], licenseTermsIds: [PROV_TERMS] },
    ipMetadata: { ipMetadataURI: der.uri, ipMetadataHash: der.hash, nftMetadataURI: der.uri, nftMetadataHash: der.hash },
  } as any);
  const CHILD = (child as any).ipId as `0x${string}`;
  logTx("register derivative", (child as any).txHash);

  console.log("=== 07-oss-lineage (Addendum §A) ===");
  console.log("external_source:", HF_URL);
  console.log("provenance parent ipId:", PROV);
  console.log("derivative ipId:", CHILD);
  console.log("✓ metadata asserts no ownership (attribution-only, non-commercial)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
