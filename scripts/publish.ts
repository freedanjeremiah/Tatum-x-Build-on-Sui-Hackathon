// Publish the Reef Move package to Sui and capture REEF_PACKAGE_ID.
//
// Uses the Sui CLI's active environment + keystore (the reliable, battle-tested
// publish path). Make sure, before running:
//   1. `sui client active-env`  is a testnet env (e.g. `sui client new-env
//      --alias testnet --rpc https://fullnode.testnet.sui.io:443 && sui client
//      switch --env testnet`).
//   2. `sui client active-address` is funded (testnet faucet: `sui client faucet`).
//
// Run:  pnpm publish:move
// On success it prints the package id AND writes REEF_PACKAGE_ID into .env.local
// (creating it from .env.local.example if missing), so the app + scripts pick it up.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const MOVE_DIR = resolve(ROOT, "move");
const ENV_PATH = resolve(ROOT, ".env.local");
const ENV_EXAMPLE = resolve(ROOT, ".env.local.example");
const GAS_BUDGET = process.env.PUBLISH_GAS_BUDGET ?? "200000000";

/** Pull the published package id out of `sui client publish --json` output. */
function findPackageId(json: unknown): string | undefined {
  const root = json as Record<string, unknown>;
  const changes = (root.objectChanges ?? []) as Array<Record<string, unknown>>;
  const published = changes.find((c) => c.type === "published");
  if (published && typeof published.packageId === "string") return published.packageId;
  // Fallbacks across SDK/CLI shape variations.
  const effects = root.effects as Record<string, unknown> | undefined;
  const created = (effects?.created ?? []) as Array<Record<string, unknown>>;
  for (const c of created) {
    const owner = c.owner;
    if (owner === "Immutable") {
      const ref = c.reference as Record<string, unknown> | undefined;
      if (ref && typeof ref.objectId === "string") return ref.objectId;
    }
  }
  return undefined;
}

/** Insert or replace a KEY=value line in .env.local (idempotent). */
function upsertEnv(key: string, value: string): void {
  if (!existsSync(ENV_PATH)) {
    if (existsSync(ENV_EXAMPLE)) copyFileSync(ENV_EXAMPLE, ENV_PATH);
    else writeFileSync(ENV_PATH, "");
  }
  const lines = readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  let found = false;
  const next = lines.map((l) => {
    if (l.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return l;
  });
  if (!found) next.push(`${key}=${value}`);
  writeFileSync(ENV_PATH, next.join("\n"));
}

function main(): void {
  console.log(`Publishing Reef Move package from ${MOVE_DIR} (gas budget ${GAS_BUDGET})…`);
  let out: string;
  try {
    out = execFileSync(
      "sui",
      [
        "client",
        "publish",
        "--gas-budget",
        GAS_BUDGET,
        "--json",
        "--skip-dependency-verification",
      ],
      { cwd: MOVE_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (e) {
    console.error(
      "\nPublish failed. Check that `sui client active-env` is testnet and " +
        "`sui client active-address` is funded (`sui client faucet`).",
    );
    throw e;
  }

  // The CLI may print non-JSON warnings before the JSON object; slice from the first '{'.
  const start = out.indexOf("{");
  const parsed = JSON.parse(start >= 0 ? out.slice(start) : out);
  const packageId = findPackageId(parsed);

  if (!packageId) {
    console.error(
      "\nPublished, but could not auto-detect the package id from the output. " +
        "Find the `published` objectChange (packageId) in the JSON above and set " +
        "REEF_PACKAGE_ID in .env.local manually.",
    );
    process.exitCode = 1;
    return;
  }

  upsertEnv("REEF_PACKAGE_ID", packageId);
  console.log(`\n✓ Published. REEF_PACKAGE_ID=${packageId}`);
  console.log("  Written to .env.local. Restart `pnpm dev` to pick it up.");
}

main();
