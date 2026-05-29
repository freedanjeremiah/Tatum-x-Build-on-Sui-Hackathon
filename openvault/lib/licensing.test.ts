import { test, expect } from "vitest";
import { encodeAbiParameters } from "viem";
import {
  commercialRemixTerms,
  attributionTerms,
  computeTerms,
  encodeAccessAuxData,
} from "./licensing";

test("encodeAccessAuxData([1n]) equals the direct viem encodeAbiParameters call", () => {
  const got = encodeAccessAuxData([1n]);
  const expected = encodeAbiParameters([{ type: "uint256[]" }], [[1n]]);
  expect(got).toBe(expected);
});

test("attributionTerms().commercialUse is false", () => {
  expect(attributionTerms().commercialUse).toBe(false);
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
