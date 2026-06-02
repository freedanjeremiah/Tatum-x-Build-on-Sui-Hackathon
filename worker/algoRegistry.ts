// Algorithm allowlist registry: maps algoHash → algorithm module.
//
// HONESTY / SECURITY MODEL: a compute dataset declares a per-dataset allowlist
// of algoHashes (e.g. "sha256:mean-aggregate"). The worker will ONLY run an
// algorithm whose hash is BOTH on the dataset's allowlist AND registered here.
// The hash is the stable content identity of the algo: "sha256:" + <name>,
// matching the seed's allowedAlgoHashes ("sha256:mean-aggregate" /
// "sha256:logistic-regression"). Every registered algo returns AGGREGATES /
// model coefficients only — never the raw rows.
//
// INTENTIONALLY ABSENT (blocked by design): identity / dump-all-rows /
// export-all-rows / nearest-neighbor and any other algorithm that could
// reconstruct an individual record. They are not registered, so getAlgo()
// returns undefined and the worker rejects them BEFORE any decryption. This is
// the whole point of "private but computable": only privacy-preserving,
// non-reconstructing computations are permitted over the plaintext.

import * as meanAggregate from "./algos/mean-aggregate";
import * as logisticRegression from "./algos/logistic-regression";

/** An allowlisted algorithm: a stable name + a pure run() over numeric rows. */
export interface Algo {
  name: string;
  run: (rows: number[][], params?: Record<string, unknown>) => unknown;
}

/** Stable content identity for an algo module: "sha256:" + <name>. */
function hashOf(algo: Algo): string {
  return "sha256:" + algo.name;
}

const ALGOS: Algo[] = [
  { name: meanAggregate.name, run: meanAggregate.run as Algo["run"] },
  { name: logisticRegression.name, run: logisticRegression.run as Algo["run"] },
];

const REGISTRY: Map<string, Algo> = new Map(ALGOS.map((a) => [hashOf(a), a]));

/** Resolve an allowlisted algo by hash; undefined if not registered (blocked). */
export function getAlgo(algoHash: string): Algo | undefined {
  return REGISTRY.get(algoHash);
}

/** Enumerate the registered (allowlisted) algorithms. */
export function listAlgos(): Algo[] {
  return [...REGISTRY.values()];
}
