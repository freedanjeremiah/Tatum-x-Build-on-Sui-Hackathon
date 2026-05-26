import { test, expect } from "vitest";
import { openDb, upsertArtifact, getArtifact, listArtifacts } from "./db";
import { SEED_ARTIFACTS } from "../lib/mock/seed";
import type { Artifact } from "../types/artifact";

function sample(): Artifact {
  return {
    ipId: "0xabc0000000000000000000000000000000000001",
    tier: "compute",
    modality: "dataset",
    title: "Test Cohort",
    description: "A confidential test dataset for round-trip checks.",
    tags: ["test", "roundtrip", "compute"],
    ipMetadataURI: "ipfs://bafyTestMeta",
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
  for (const a of SEED_ARTIFACTS) upsertArtifact(db, a);
  const gated = listArtifacts(db, { tier: "gated" });
  expect(gated.length).toBe(2); // SentimentLLM-7B + derivative
  expect(gated.every((a) => a.tier === "gated")).toBe(true);
});

test("listArtifacts filters by modality", () => {
  const db = openDb(":memory:");
  for (const a of SEED_ARTIFACTS) upsertArtifact(db, a);
  const datasets = listArtifacts(db, { modality: "dataset" });
  expect(datasets.length).toBeGreaterThan(0);
  expect(datasets.every((a) => a.modality === "dataset")).toBe(true);
});

test("listArtifacts filters by q substring (case-insensitive on title/desc/tags)", () => {
  const db = openDb(":memory:");
  for (const a of SEED_ARTIFACTS) upsertArtifact(db, a);
  const byTitle = listArtifacts(db, { q: "sentiment" });
  expect(byTitle.length).toBeGreaterThan(0);
  expect(byTitle.every((a) => /sentiment/i.test(a.title + a.description + a.tags.join(" ")))).toBe(true);

  const byTag = listArtifacts(db, { q: "GENOMICS" });
  expect(byTag.some((a) => a.tags.includes("genomics"))).toBe(true);
});

test("seeding SEED_ARTIFACTS yields 6 rows", () => {
  const db = openDb(":memory:");
  for (const a of SEED_ARTIFACTS) upsertArtifact(db, a);
  expect(listArtifacts(db, {})).toHaveLength(6);
});
