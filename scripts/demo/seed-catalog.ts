// Seeds the local read-model (indexer/reef.db) so the :3000 UI has a browseable
// catalog for the demo: 10 sample datasets + 10 sample models (display-only public
// descriptors) PLUS the one REAL compute-tier dataset (Seal-encrypted on Walrus,
// allowlisted for mean-aggregate, worker on-chain) that the UI runs compute against.
//
// Run:  node --import tsx scripts/demo/seed-catalog.ts
import { openDb, upsertArtifact } from "../../indexer/db";
import type { Artifact } from "../../types/artifact";

const OWNER = "0x7c6d094aaefc9ed68df43a9da6205ec9ab6c2433af3729cf7efb56de1b3d0c7a" as const;
const id = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as `0x${string}`;

// The real, on-chain compute-tier dataset (registered on testnet; Walrus blob + Seal).
const COMPUTE_DATASET: Artifact = {
  ipId: "0xdcb43aeb3b2d6c14be413061826e1c6cd885c58e70b2f841ba15b9057d32f1fa",
  tier: "compute",
  modality: "dataset",
  title: "Confidential Numeric Rows (live)",
  description:
    "Private CSV, Seal-encrypted on Walrus. Run mean-aggregate INSIDE the AWS Nitro enclave — only aggregate metrics leave, and the result is verified on-chain via register_derivative_attested.",
  tags: ["confidential", "compute", "tabular", "live", "nitro-enclave"],
  ipMetadataURI: "",
  createdTx: "" as `0x${string}`,
  owner: OWNER,
  computeEnabled: true,
  allowedAlgoHashes: ["sha256:mean-aggregate"],
  cid: "D1zCTEtJdsHf2U4GPGV58p3jjHogO1wA6zQhS4q8ktU",
  score: 99,
};

const DATASETS: Array<Partial<Artifact> & { title: string; tier: Artifact["tier"] }> = [
  { title: "Global Retail Transactions 2024", tier: "gated", tags: ["tabular", "retail", "sales"] },
  { title: "Sentinel-2 Cloud Masks (EU)", tier: "public", tags: ["imagery", "geospatial"] },
  { title: "ICU Vitals Time-Series (de-identified)", tier: "private", tags: ["healthcare", "timeseries"] },
  { title: "Multilingual Support Tickets", tier: "gated", tags: ["nlp", "text", "support"] },
  { title: "EV Charging Sessions — North America", tier: "public", tags: ["energy", "tabular"] },
  { title: "Crop Yield + Weather Joins", tier: "group", tags: ["agriculture", "tabular"] },
  { title: "Anonymized Mobile Clickstream", tier: "private", tags: ["behavioral", "events"] },
  { title: "Financial News Headlines (labeled)", tier: "gated", tags: ["nlp", "finance"] },
  { title: "Urban Air-Quality Sensor Grid", tier: "public", tags: ["iot", "timeseries"] },
  { title: "Wholesale Electricity Prices (hourly)", tier: "gated", tags: ["energy", "timeseries"] },
];

const MODELS: Array<Partial<Artifact> & { title: string; tier: Artifact["tier"] }> = [
  { title: "SentimentLLM-7B (finance-tuned)", tier: "gated", tags: ["llm", "nlp", "finance"] },
  { title: "RetailDemand-Forecaster v3", tier: "gated", tags: ["forecasting", "tabular"] },
  { title: "CloudSeg-UNet (Sentinel-2)", tier: "public", tags: ["vision", "segmentation"] },
  { title: "ICU-RiskScore (gradient-boosted)", tier: "private", tags: ["healthcare", "tabular"] },
  { title: "TicketRouter-Multilingual", tier: "gated", tags: ["nlp", "classification"] },
  { title: "EVLoad-GNN", tier: "public", tags: ["graph", "energy"] },
  { title: "CropYield-Regressor", tier: "group", tags: ["agriculture", "regression"] },
  { title: "Clickstream-Churn Classifier", tier: "private", tags: ["behavioral", "classification"] },
  { title: "NewsImpact-Embedder", tier: "public", tags: ["nlp", "embeddings"] },
  { title: "AirQuality-Transformer", tier: "gated", tags: ["timeseries", "transformer"] },
];

function mk(base: Partial<Artifact> & { title: string; tier: Artifact["tier"] }, modality: Artifact["modality"], n: number): Artifact {
  return {
    ipId: id(n),
    tier: base.tier,
    modality,
    title: base.title,
    description:
      modality === "model"
        ? `Pretrained ${base.title}. Licensed on-chain; weights Seal-encrypted on Walrus. A license is the decryption credential.`
        : `${base.title}. Seal-encrypted on Walrus; access gated on-chain by the Move seal_approve policy.`,
    tags: base.tags ?? [],
    ipMetadataURI: "",
    createdTx: "" as `0x${string}`,
    owner: OWNER,
    score: 50 - n,
  };
}

function main() {
  const db = openDb();
  upsertArtifact(db, COMPUTE_DATASET);
  let n = 100;
  for (const d of DATASETS) upsertArtifact(db, mk(d, "dataset", n++));
  for (const m of MODELS) upsertArtifact(db, mk(m, "model", n++));
  const total = 1 + DATASETS.length + MODELS.length;
  console.log(`seeded ${total} artifacts (1 live compute dataset + ${DATASETS.length} datasets + ${MODELS.length} models)`);
  console.log(`compute dataset: ${COMPUTE_DATASET.ipId}`);
}
main();
