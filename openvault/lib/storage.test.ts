import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { pinJSON, pinFile, heliaProvider } from "./storage";

test("pinJSON is deterministic for the same input", async () => {
  const obj = { title: "x", n: 1 };
  const a = await pinJSON(obj);
  const b = await pinJSON(obj);
  expect(a.uri).toBe(b.uri);
  expect(a.hash).toBe(b.hash);
});

test("pinJSON hash recomputes from the pinned content (mock)", async () => {
  const obj = { title: "SentimentLLM-7B", modality: "model" };
  const { hash, uri } = await pinJSON(obj);
  const expected = "0x" + createHash("sha256").update(JSON.stringify(obj)).digest("hex");
  expect(hash).toBe(expected);
  expect(uri.startsWith("ipfs://mock")).toBe(true);
  expect(uri).toContain(hash.slice(2));
});

test("pinFile returns deterministic uri+hash for raw bytes (mock)", async () => {
  const bytes = new TextEncoder().encode("public weather rows");
  const a = await pinFile(bytes);
  const b = await pinFile(bytes);
  expect(a.hash).toBe(b.hash);
  const expected = "0x" + createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  expect(a.hash).toBe(expected);
  expect(a.uri.startsWith("ipfs://mock")).toBe(true);
});

test("heliaProvider() returns an object exposing a CID function", async () => {
  const p = await heliaProvider();
  expect(typeof p.CID).toBe("function");
  // mock CID is identity over a string
  expect(p.CID("bafyabc")).toBe("bafyabc");
});
