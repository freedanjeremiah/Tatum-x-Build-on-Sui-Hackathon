// Shared helpers for the Phase 1 headless flow scripts.
// In MOCK mode (NEXT_PUBLIC_MOCK=1, the default) every script runs with no
// credentials and prints deterministic tx hashes + decrypted output.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { makeClientsFromKey } from "../lib/clients";
import { IS_MOCK } from "../lib/env";
import { STORYSCAN_TX } from "../lib/constants";

// Scripts run under tsx in CJS output (no "type":"module"), so __dirname exists.
const HERE = typeof __dirname !== "undefined" ? __dirname : process.cwd();

// --- Load .env.local if present (so real-mode picks up WALLET_PRIVATE_KEY etc.) ---
const ENV_LOCAL = resolve(HERE, "..", ".env.local");
try {
  // dotenv is a devDependency; require lazily so the script never hard-fails on it.
  const req = createRequire(import.meta.url);
  const dotenv = req("dotenv");
  if (existsSync(ENV_LOCAL)) dotenv.config({ path: ENV_LOCAL });
  else dotenv.config();
} catch {
  // dotenv missing — fine, rely on the ambient process.env.
}

// Where the upload script stashes ids for the download script to read.
const LAST_FILE = resolve(HERE, ".last-upload.json");

/**
 * Returns the {cdr, story, account, ...} client bundle.
 * - Real mode: uses WALLET_PRIVATE_KEY.
 * - Mock mode: a throwaway zero key (makeClientsFromKey ignores it and returns mocks).
 */
export async function getClients() {
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (pk && !IS_MOCK) {
    return makeClientsFromKey(pk as `0x${string}`);
  }
  // Mock mode (or no key): a deterministic zero key — mocks ignore it.
  return makeClientsFromKey(("0x" + "00".repeat(32)) as `0x${string}`);
}

/** Print a labeled link to the Story tx explorer. */
export function logTx(label: string, hash: string) {
  console.log(`${label}: ${STORYSCAN_TX}${hash}`);
}

/** Persist a small JSON blob (uuid/ipId/licenseTermsId/...) for the next script. */
export function saveLast(obj: Record<string, unknown>) {
  writeFileSync(
    LAST_FILE,
    JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );
}

/** Read what the previous script saved (or throw a helpful error). */
export function readLast(): Record<string, any> {
  if (!existsSync(LAST_FILE)) {
    throw new Error(
      `No ${LAST_FILE} found — run scripts/01-upload-gated.ts first.`
    );
  }
  return JSON.parse(readFileSync(LAST_FILE, "utf8"));
}

// Smoke: `pnpm tsx scripts/_util.ts` must not throw.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("_util.ts")) {
  console.log(`_util ok — IS_MOCK=${IS_MOCK}, explorer=${STORYSCAN_TX}`);
}
