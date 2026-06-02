import { test, expect, beforeEach } from "vitest";
import { generateSimulatedQuote, verifySimulatedQuote, SIM_DISCLOSURE } from "./tee-sim";

const WORKER: `0x${string}` = "0x29bCb9811A60434514c245629DCE2FE4843E3C50";
const ALGO = "sha256:mean-aggregate";

beforeEach(() => {
  // Pin the secret so signatures are deterministic across runs.
  process.env.WORKER_SIM_KEY = "test-secret-v1";
});

test("sim quote is deterministic for a given (worker, algo) pair", () => {
  const q1 = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  const q2 = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  expect(q1.body.mrEnclave).toBe(q2.body.mrEnclave);
  expect(q1.body.mrSigner).toBe(q2.body.mrSigner);
  expect(q1.body.reportData).toBe(q2.body.reportData);
  expect(q1.signature).toBe(q2.signature);
});

test("sim quote carries the HONEST disclosure string", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  expect(q.disclosure).toBe(SIM_DISCLOSURE);
  expect(q.disclosure).toContain("Simulated enclave");
  expect(q.disclosure).toContain("UNVERIFIED");
  expect(q.kind).toBe("sim-sgx-quote");
  expect(q.header.teeType).toBe("SGX-SIM");
});

test("verify accepts a fresh quote with mode='sim'", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  const v = verifySimulatedQuote(q);
  expect(v.ok).toBe(true);
  expect(v.mode).toBe("sim");
  expect(v.reasons).toEqual([]);
});

test("verify rejects a tampered body", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  const tampered = { ...q, body: { ...q.body, isvSvn: q.body.isvSvn + 5 } };
  const v = verifySimulatedQuote(tampered);
  expect(v.ok).toBe(false);
  expect(v.reasons).toContain("signature mismatch");
});

test("verify rejects a different secret", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  process.env.WORKER_SIM_KEY = "different-secret";
  const v = verifySimulatedQuote(q);
  expect(v.ok).toBe(false);
  expect(v.reasons).toContain("signature mismatch");
});

test("verify enforces minSecurityVersion", () => {
  process.env.WORKER_SIM_KEY = "test-secret-v1";
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO, isvSvn: 2 });
  const v = verifySimulatedQuote(q, { minSecurityVersion: 5 });
  expect(v.ok).toBe(false);
  expect(v.reasons.some((r) => r.includes("minSecurityVersion"))).toBe(true);
});

test("verify enforces expectedMrEnclave mismatch", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  const v = verifySimulatedQuote(q, {
    expectedMrEnclave: ("0x" + "00".repeat(32)) as `0x${string}`,
  });
  expect(v.ok).toBe(false);
  expect(v.reasons.some((r) => r.includes("mrEnclave"))).toBe(true);
});

test("verify mode is ALWAYS 'sim' — never claims hardware", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  const okResult = verifySimulatedQuote(q);
  const badResult = verifySimulatedQuote({ ...q, signature: "0x" + "ff".repeat(32) as `0x${string}` });
  expect(okResult.mode).toBe("sim");
  expect(badResult.mode).toBe("sim");
});

test("kind marker prevents accidental hardware-quote confusion", () => {
  const q = generateSimulatedQuote({ workerIdentity: WORKER, algoHash: ALGO });
  // A real Intel SGX quote would NOT have kind:"sim-sgx-quote"; downstream
  // verifiers can short-circuit on this marker without doing crypto.
  expect(q.kind).toBe("sim-sgx-quote");
  // header.teeType must NEVER be just "SGX" — that would be a forgery.
  expect(q.header.teeType).toBe("SGX-SIM");
  expect((q.header.teeType as string)).not.toBe("SGX");
});
