import { test, expect } from "vitest";
import {
  commercialRemixTerms,
  attributionTerms,
  computeTerms,
  encodeAccessAuxData,
  SUI_CURRENCY,
} from "./licensing";

// CHANGED (B3a, Sui migration): the old test asserted encodeAccessAuxData matched
// viem's ABI uint256[] encoding. On Sui there is no ABI read-condition aux blob —
// access is gated entirely by on-chain `license_holders` + `seal_approve`, so the
// helper now returns a deterministic JSON-array string of the artifact ids it is
// given (retained only for caller compatibility). We assert that new shape here.
test("encodeAccessAuxData stringifies ids as a JSON array", () => {
  expect(encodeAccessAuxData([1n])).toBe('["1"]');
  expect(encodeAccessAuxData(["0xabc", 2n])).toBe('["0xabc","2"]');
});

test("attributionTerms().commercialUse is false", () => {
  expect(attributionTerms().commercialUse).toBe(false);
  expect(attributionTerms().currency).toBe(SUI_CURRENCY);
});

test("commercialRemixTerms({rev:5,fee:1n}).commercialRevShare === 5", () => {
  const t = commercialRemixTerms({ rev: 5, fee: 1n });
  expect(t.commercialRevShare).toBe(5);
  expect(t.defaultMintingFee).toBe(1n);
  expect(t.commercialUse).toBe(true);
});

test("computeTerms exposes commercial fields", () => {
  const t = computeTerms({ rev: 3, fee: 2n });
  expect(t.commercialRevShare).toBe(3);
  expect(t.defaultMintingFee).toBe(2n);
  expect(t.commercialUse).toBe(true);
});
