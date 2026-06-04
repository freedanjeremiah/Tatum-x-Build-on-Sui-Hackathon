// Shared helpers for the Phase 1 headless flow scripts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

import { makeClientsFromKey } from "../lib/clients";
import { SUI_EXPLORER_TX } from "../lib/constants";

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
 * Returns the Sui ServerClients bundle ({ client, signer, address, account, ... }).
 * Requires WALLET_PRIVATE_KEY (or MASTER_SUI_PRIVKEY) in the environment; throws
 * loudly if absent. No fake fallback.
 */
export async function getClients() {
  const pk = process.env.WALLET_PRIVATE_KEY ?? process.env.MASTER_SUI_PRIVKEY;
  if (!pk) {
    throw new Error(
      "WALLET_PRIVATE_KEY (or MASTER_SUI_PRIVKEY) is not set. Add it to .env.local and re-run with --env-file .env.local."
    );
  }
  return makeClientsFromKey(pk);
}

/** Print a labeled link to the Sui tx explorer. */
export function logTx(label: string, hash: string) {
  console.log(`${label}: ${SUI_EXPLORER_TX}${hash}`);
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

const INDEX_URL = process.env.TESSERA_INDEX_URL ?? "http://localhost:3000/api/index";

/**
 * POST the public Artifact descriptor to the running dev server's `/api/index`
 * route so the read model has it immediately. No-op if the server is not up —
 * scripts must keep working headlessly.
 */
export async function selfIndex(artifact: Record<string, unknown>): Promise<void> {
  try {
    const body = JSON.stringify(artifact, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    const res = await fetch(INDEX_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[self-index] ${res.status}: ${text}`);
    } else {
      console.log(`[self-index] ok ${(artifact as { ipId?: string }).ipId ?? ""}`);
    }
  } catch (e) {
    console.warn(`[self-index] skipped: ${(e as Error).message}`);
  }
}

// Smoke: `pnpm tsx scripts/_util.ts` must not throw.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("_util.ts")) {
  console.log(`_util ok — explorer=${SUI_EXPLORER_TX}`);
}
