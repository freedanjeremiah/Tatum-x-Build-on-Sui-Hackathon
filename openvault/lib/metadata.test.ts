import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { buildIpaMetadata } from "./metadata";

const owner = "0x000000000000000000000000000000000000dEaD" as const;

test("buildIpaMetadata returns 4 non-empty fields", async () => {
  const m = await buildIpaMetadata({
    title: "SentimentLLM-7B",
    description: "gated model",
    tags: ["llm", "gated"],
    creators: [{ name: "OpenVault", address: owner, contributionPercent: 100 }],
    modality: "model",
    commercial: true,
  });
  expect(m.ipMetadataURI).toBeTruthy();
  expect(m.ipMetadataHash).toBeTruthy();
  expect(m.nftMetadataURI).toBeTruthy();
  expect(m.nftMetadataHash).toBeTruthy();
});

test("ipMetadataHash recomputes from the pinned content (mock deterministic hash)", async () => {
  const args = {
    title: "Dataset X",
    description: "rows",
    tags: ["data"],
    creators: [{ name: "Me", address: owner, contributionPercent: 100 }],
    modality: "dataset" as const,
  };
  const m = await buildIpaMetadata(args);
  // The mock uri carries the full hash after "ipfs://mock".
  const hashFromUri = "0x" + m.ipMetadataURI.replace("ipfs://mock", "");
  expect(hashFromUri).toBe(m.ipMetadataHash);
  // And re-hashing the (deterministic) ipMetadata object yields the same hash.
  const recomputed =
    "0x" + createHash("sha256").update(m.__ipMetadataJSON!).digest("hex");
  expect(recomputed).toBe(m.ipMetadataHash);
});

test("OSS-parent metadata carries external_source and no commercial flag", async () => {
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
