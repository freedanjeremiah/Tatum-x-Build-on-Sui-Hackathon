import { test, expect } from "vitest";
import { openDb, upsertArtifact, getArtifact, listArtifacts } from "./db";
import type { Artifact } from "../types/artifact";

// Inline fixtures: 6 minimal valid Artifacts spanning tiers. The list tests
// expect exactly 2 "gated" rows (one mentioning "sentiment"), at least one
// "dataset" modality, and a "genomics" tag — kept in sync with those asserts.
const FIXTURE: Artifact[] = [
  {
    ipId: "0xpub0000000000000000000000000000000000001",
    tier: "public",
    modality: "dataset",
    title: "OpenWeather Hourly 2015-2024",
    description: "Decade of hourly weather observations.",
    tags: ["weather", "timeseries", "public"],
    ipMetadataURI: "walrus://bafyMeta1",
    cid: "bafy1",
    licenseTermsId: "1001",
    ownerNftTokenId: BigInt(1),
    createdTx: "0xtx1",
    score: 1480,
  },
  {
    ipId: "0xprv0000000000000000000000000000000000002",
    tier: "private",
    modality: "model",
    title: "FraudNet-v3 (Private)",
    description: "Proprietary transaction-fraud classifier.",
    tags: ["fraud", "classifier", "private"],
    ipMetadataURI: "walrus://bafyMeta2",
    vaultUuid: 2,
    cid: "bafy2",
    licenseTermsId: "1002",
    ownerNftTokenId: BigInt(2),
    createdTx: "0xtx2",
    score: 210,
  },
  {
    ipId: "0xgat0000000000000000000000000000000000003",
    tier: "gated",
    modality: "model",
    title: "SentimentLLM-7B",
    description: "7B-parameter sentiment model, license-gated weights.",
    tags: ["llm", "sentiment", "gated"],
    ipMetadataURI: "walrus://bafyMeta3",
    vaultUuid: 3,
    cid: "bafy3",
    licenseTermsId: "1003",
    ownerNftTokenId: BigInt(3),
    createdTx: "0xtx3",
    score: 3120,
  },
  {
    ipId: "0xgrp0000000000000000000000000000000000004",
    tier: "group",
    modality: "model",
    title: "VisionEnsemble (Group)",
    description: "Community ensemble of vision models.",
    tags: ["vision", "ensemble", "group"],
    ipMetadataURI: "walrus://bafyMeta4",
    vaultUuid: 4,
    cid: "bafy4",
    licenseTermsId: "1004",
    groupId: "0xgroup0000000000000000000000000000000004",
    ownerNftTokenId: BigInt(4),
    createdTx: "0xtx4",
    score: 870,
  },
  {
    ipId: "0xcmp0000000000000000000000000000000000005",
    tier: "compute",
    modality: "dataset",
    title: "GenomeBank Confidential Cohort",
    description: "Sensitive genomic cohort; compute-only access.",
    tags: ["genomics", "healthcare", "compute"],
    ipMetadataURI: "walrus://bafyMeta5",
    vaultUuid: 5,
    cid: "bafy5",
    licenseTermsId: "1005",
    computeLicenseTermsId: "2005",
    ownerNftTokenId: BigInt(5),
    createdTx: "0xtx5",
    computeEnabled: true,
    allowedAlgoHashes: ["sha256:mean-aggregate", "sha256:logistic-regression"],
    score: 2050,
  },
  {
    ipId: "0xder0000000000000000000000000000000000006",
    tier: "gated",
    modality: "model",
    title: "SentimentLLM-7B-Finetuned-Reviews",
    description: "Derivative of SentimentLLM-7B fine-tuned on reviews.",
    tags: ["llm", "sentiment", "derivative"],
    ipMetadataURI: "walrus://bafyMeta6",
    vaultUuid: 6,
    cid: "bafy6",
    licenseTermsId: "1006",
    parentIpId: "0xgat0000000000000000000000000000000000003",
    ownerNftTokenId: BigInt(6),
    createdTx: "0xtx6",
    score: 640,
  },
];

function sample(): Artifact {
  return {
    ipId: "0xabc0000000000000000000000000000000000001",
    tier: "compute",
    modality: "dataset",
    title: "Test Cohort",
    description: "A confidential test dataset for round-trip checks.",
    tags: ["test", "roundtrip", "compute"],
    ipMetadataURI: "walrus://bafyTestMeta",
    vaultUuid: 7,
    cid: "bafyTest",
    licenseTermsId: "9001",
    ownerNftTokenId: BigInt(42),
    createdTx: "0xtesttx",
    computeEnabled: true,
    allowedAlgoHashes: ["sha256:mean", "sha256:logreg"],
    computeLicenseTermsId: "9002",
    score: 3.14,
  };
}

test("upsert then getArtifact round-trips an Artifact", () => {
  const db = openDb(":memory:");
  const a = sample();
  upsertArtifact(db, a);
  const got = getArtifact(db, a.ipId);
  expect(got).toBeDefined();
  expect(got!.ipId).toBe(a.ipId);
  expect(got!.tier).toBe("compute");
  expect(got!.modality).toBe("dataset");
  expect(got!.title).toBe(a.title);
  expect(got!.description).toBe(a.description);
  expect(got!.tags).toEqual(["test", "roundtrip", "compute"]);
  expect(got!.computeEnabled).toBe(true);
  expect(got!.allowedAlgoHashes).toEqual(["sha256:mean", "sha256:logreg"]);
  expect(got!.vaultUuid).toBe(7);
  expect(got!.ownerNftTokenId).toBe(BigInt(42));
  expect(typeof got!.ownerNftTokenId).toBe("bigint");
  expect(got!.score).toBeCloseTo(3.14);
});

test("upsert is idempotent: twice yields one row with updated values", () => {
  const db = openDb(":memory:");
  const a = sample();
  upsertArtifact(db, a);
  upsertArtifact(db, { ...a, title: "Updated Title", score: 99 });
  const all = listArtifacts(db, {});
  expect(all).toHaveLength(1);
  expect(all[0].title).toBe("Updated Title");
  expect(all[0].score).toBe(99);
});

test("listArtifacts filters by tier", () => {
  const db = openDb(":memory:");
  for (const a of FIXTURE) upsertArtifact(db, a);
  const gated = listArtifacts(db, { tier: "gated" });
  expect(gated.length).toBe(2); // SentimentLLM-7B + derivative
  expect(gated.every((a) => a.tier === "gated")).toBe(true);
});

test("listArtifacts filters by modality", () => {
  const db = openDb(":memory:");
  for (const a of FIXTURE) upsertArtifact(db, a);
  const datasets = listArtifacts(db, { modality: "dataset" });
  expect(datasets.length).toBeGreaterThan(0);
  expect(datasets.every((a) => a.modality === "dataset")).toBe(true);
});

test("listArtifacts filters by q substring (case-insensitive on title/desc/tags)", () => {
  const db = openDb(":memory:");
  for (const a of FIXTURE) upsertArtifact(db, a);
  const byTitle = listArtifacts(db, { q: "sentiment" });
  expect(byTitle.length).toBeGreaterThan(0);
  expect(byTitle.every((a) => /sentiment/i.test(a.title + a.description + a.tags.join(" ")))).toBe(true);

  const byTag = listArtifacts(db, { q: "GENOMICS" });
  expect(byTag.some((a) => a.tags.includes("genomics"))).toBe(true);
});

test("seeding FIXTURE yields 6 rows", () => {
  const db = openDb(":memory:");
  for (const a of FIXTURE) upsertArtifact(db, a);
  expect(listArtifacts(db, {})).toHaveLength(6);
});

test("owner round-trips through upsert/get", () => {
  const db = openDb(":memory:");
  const a: Artifact = {
    ipId: "0xown0000000000000000000000000000000000099",
    tier: "public",
    modality: "dataset",
    title: "Owned",
    description: "has an owner",
    tags: ["x"],
    ipMetadataURI: "walrus://m",
    createdTx: "0xtxOwn",
    owner: "0x29bCb9811A60434514c245629DCE2FE4843E3C50",
  };
  upsertArtifact(db, a);
  const got = getArtifact(db, a.ipId);
  expect(got?.owner).toBe("0x29bCb9811A60434514c245629DCE2FE4843E3C50");
});

test("listArtifacts filters by owner (case-insensitive)", () => {
  const db = openDb(":memory:");
  const base = {
    tier: "public" as const, modality: "dataset" as const,
    description: "d", tags: ["t"], ipMetadataURI: "walrus://m", createdTx: "0xtx" as `0x${string}`,
  };
  upsertArtifact(db, { ...base, ipId: "0xa1", title: "A", owner: "0xAaAa000000000000000000000000000000000001" });
  upsertArtifact(db, { ...base, ipId: "0xb2", title: "B", owner: "0xBbBb000000000000000000000000000000000002" });
  const mine = listArtifacts(db, { owner: "0xaaaa000000000000000000000000000000000001" });
  expect(mine.map((x) => x.ipId)).toEqual(["0xa1"]);
});
