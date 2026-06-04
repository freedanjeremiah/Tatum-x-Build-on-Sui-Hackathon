import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { RUN_INTEGRATION } from "./itest";
import { buildIpaMetadata } from "./metadata";

// buildIpaMetadata writes to live Walrus storage (needs a signer + network), so
// these are gated and skip by default.
const itInt = test.skipIf(!RUN_INTEGRATION);

const owner = "0x000000000000000000000000000000000000dEaD" as const;

itInt("buildIpaMetadata returns 4 non-empty fields", async () => {
  const m = await buildIpaMetadata({
    title: "SentimentLLM-7B",
    description: "gated model",
    tags: ["llm", "gated"],
    creators: [{ name: "Reef", address: owner, contributionPercent: 100 }],
    modality: "model",
    commercial: true,
  });
  expect(m.ipMetadataURI).toBeTruthy();
  expect(m.ipMetadataHash).toBeTruthy();
  expect(m.nftMetadataURI).toBeTruthy();
  expect(m.nftMetadataHash).toBeTruthy();
});

itInt("ipMetadataHash recomputes from the pinned content (deterministic hash)", async () => {
  const args = {
    title: "Dataset X",
    description: "rows",
    tags: ["data"],
    creators: [{ name: "Me", address: owner, contributionPercent: 100 }],
    modality: "dataset" as const,
  };
  const m = await buildIpaMetadata(args);
  expect(m.ipMetadataURI.startsWith("walrus-meta://")).toBe(true);
  // Re-hashing the (deterministic) ipMetadata object yields the same hash.
  const recomputed =
    "0x" + createHash("sha256").update(m.__ipMetadataJSON!).digest("hex");
  expect(recomputed).toBe(m.ipMetadataHash);
});

itInt("OSS-parent metadata carries external_source and no commercial flag", async () => {
  const m = await buildIpaMetadata({
    title: "Llama-3-8B (OSS provenance)",
    description: "external model",
    tags: ["oss"],
    creators: [{ name: "Meta AI", address: owner, contributionPercent: 100 }],
    modality: "model",
    externalSource: "https://huggingface.co/meta-llama/Llama-3-8B",
    // commercial intentionally omitted/false
  });
  const ipa = JSON.parse(m.__ipMetadataJSON!);
  expect(ipa.external_source).toBe("https://huggingface.co/meta-llama/Llama-3-8B");
  expect(ipa.commercial).toBeUndefined();
});
