import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { RUN_INTEGRATION } from "./itest";
import { pinJSON, pinFile, heliaProvider } from "./storage";

const itInt = test.skipIf(!RUN_INTEGRATION);

itInt("pinJSON is deterministic for the same input", async () => {
  const obj = { title: "x", n: 1 };
  const a = await pinJSON(obj);
  const b = await pinJSON(obj);
  expect(a.uri).toBe(b.uri);
  expect(a.hash).toBe(b.hash);
});

itInt("pinJSON hash recomputes from the pinned content", async () => {
  const obj = { title: "SentimentLLM-7B", modality: "model" };
  const { hash, uri } = await pinJSON(obj);
  const expected = "0x" + createHash("sha256").update(JSON.stringify(obj)).digest("hex");
  expect(hash).toBe(expected);
  expect(uri.startsWith("ipfs://")).toBe(true);
});

itInt("pinFile returns deterministic uri+hash for raw bytes", async () => {
  const bytes = new TextEncoder().encode("public weather rows");
  const a = await pinFile(bytes);
  const b = await pinFile(bytes);
  expect(a.hash).toBe(b.hash);
  const expected = "0x" + createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  expect(a.hash).toBe(expected);
  expect(a.uri.startsWith("ipfs://")).toBe(true);
});

itInt("heliaProvider() returns a storage provider object", async () => {
  const p = await heliaProvider();
  expect(typeof p).toBe("object");
  expect(p).toBeTruthy();
});
