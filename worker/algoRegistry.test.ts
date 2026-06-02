import { test, expect } from "vitest";
import { getAlgo, listAlgos } from "./algoRegistry";

test("getAlgo resolves an allowlisted hash to the algo", () => {
  const algo = getAlgo("sha256:mean-aggregate");
  expect(algo).toBeTruthy();
  expect(algo?.name).toBe("mean-aggregate");
});

test("mean-aggregate computes per-column means (non-reconstructing)", () => {
  const algo = getAlgo("sha256:mean-aggregate")!;
  const out = algo.run([
    [2, 4],
    [4, 8],
  ]) as { columnMeans: number[]; n: number };
  expect(out.columnMeans).toEqual([3, 6]);
  expect(out.n).toBe(2);
  // AGGREGATE invariant: the output must not echo any input row back.
  expect(JSON.stringify(out)).not.toContain('"rows"');
  expect(JSON.stringify(out)).not.toContain('"values"');
});

test("blocked algorithms are ABSENT from the registry (allowlist by design)", () => {
  // identity / dump / export-all-rows / nearest-neighbor are intentionally
  // NOT registered: they would reconstruct individual records.
  expect(getAlgo("sha256:dump-all-rows")).toBeUndefined();
  expect(getAlgo("sha256:identity")).toBeUndefined();
  expect(getAlgo("sha256:nearest-neighbor")).toBeUndefined();
});

test("logistic-regression returns coefficients + metrics, never the rows", () => {
  const algo = getAlgo("sha256:logistic-regression")!;
  // 2 features + label column. Linearly separable on feature 0.
  const rows = [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, 1],
    [1, 1, 1],
  ];
  const out = algo.run(rows) as {
    coefficients: number[];
    iterations: number;
    accuracy: number;
  };
  // coefficients = intercept + one weight per feature (2 features) = length 3.
  expect(out.coefficients).toHaveLength(3);
  expect(out.iterations).toBeGreaterThan(0);
  expect(typeof out.accuracy).toBe("number");
  // RESULTS ONLY: no raw rows / values leak.
  expect(JSON.stringify(out)).not.toContain('"rows"');
  expect(JSON.stringify(out)).not.toContain('"values"');
  expect("rows" in out).toBe(false);
  expect("values" in out).toBe(false);
});

test("listAlgos enumerates exactly the two allowlisted algos", () => {
  const names = listAlgos()
    .map((a) => a.name)
    .sort();
  expect(names).toEqual(["logistic-regression", "mean-aggregate"]);
});
