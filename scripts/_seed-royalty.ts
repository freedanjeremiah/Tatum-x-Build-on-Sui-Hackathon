// Seed the registry with 10 valid datasets + 10 valid models spanning every tier,
// uploading each through the real lib/artifacts path. On Sui every artifact carries
// its OWN on-chain royalty vault (`revenue: Balance<SUI>` in tessera::registry),
// so there is no separate vault object to deploy — commercial tiers (gated /
// compute) and derivatives are immediately royalty-testable. Prints a
// royalty-readiness table and writes seed-results.json (now carrying the Sui
// artifactId + ArtifactCap id needed to pay/claim later).
//
// Prereq: generate the files first —  python scripts/sample/make_seed_artifacts.py
// Run:    pnpm real scripts/_seed-royalty.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getClients, logTx, selfIndex } from "./_util";
import {
  uploadPublic,
  uploadPrivate,
  uploadGated,
  uploadCompute,
  registerDerivative,
} from "../lib/artifacts";
import type { Artifact } from "../types/artifact";

/** MIST per SUI — for converting the manifest's decimal "fee" string to a price. */
const MIST_PER_SUI = 1_000_000_000n;

function suiToMist(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(9)).slice(0, 9);
  return BigInt(whole) * MIST_PER_SUI + BigInt(fracPadded || "0");
}

type Terms = { rev: number; fee: string };
interface Entry {
  key: string;
  kind: "dataset" | "model";
  file: string;
  title: string;
  description: string;
  tags: string[];
  tier: "public" | "private" | "gated" | "compute" | "derivative";
  terms: Terms | null;
  parent: string | null;
}

const SEED_DIR = resolve(__dirname, "sample", "seed");

interface SeedRow {
  key: string;
  kind: string;
  tier: string;
  ipId: `0x${string}`;
  capId?: string;
  parent: string | null;
  /** True when this artifact can receive royalties into its own vault. On Sui
   *  ANY artifact can, but the commercial tiers + derivatives are the ones the
   *  royalty smoke test exercises. */
  hasVault: boolean;
}

async function main() {
  const clients = await getClients();
  const owner = clients.account.address as `0x${string}`;

  const manifest = JSON.parse(
    readFileSync(resolve(SEED_DIR, "seed-manifest.json"), "utf-8"),
  ) as Entry[];

  console.log(`=== seeding ${manifest.length} artifacts as ${owner} ===\n`);

  const done: Record<string, SeedRow> = {};

  for (const e of manifest) {
    const bytes = new Uint8Array(readFileSync(resolve(SEED_DIR, e.file)));
    const meta = {
      title: e.title,
      description: e.description,
      tags: e.tags,
      creators: [{ name: "Tessera Demo", address: owner, contributionPercent: 100 }],
      modality: e.kind,
    };

    console.log(`→ ${e.key} (${e.tier}, ${bytes.length}B) ${e.title}`);
    let art: Artifact | undefined;
    try {
      if (e.tier === "public") {
        art = await uploadPublic(clients, { bytes, meta });
      } else if (e.tier === "private") {
        art = await uploadPrivate(clients, { bytes, meta });
      } else if (e.tier === "gated") {
        art = await uploadGated(clients, {
          bytes,
          meta,
          terms: { rev: e.terms!.rev, fee: suiToMist(e.terms!.fee) },
        });
      } else if (e.tier === "compute") {
        art = await uploadCompute(clients, {
          bytes,
          meta,
          terms: { rev: e.terms!.rev, fee: suiToMist(e.terms!.fee) },
          allowedAlgoHashes: [],
        });
      } else if (e.tier === "derivative") {
        const parent = e.parent ? done[e.parent] : undefined;
        if (!parent) {
          throw new Error(`derivative parent ${e.parent} not registered`);
        }
        art = await registerDerivative(clients, {
          parentIpId: parent.ipId,
          bytes,
          meta,
        });
      }
    } catch (err) {
      console.error(`  ✗ register failed: ${(err as Error)?.message ?? err}\n`);
      continue;
    }
    if (!art) continue;

    logTx("  registered", art.createdTx);
    console.log(`  artifactId ${art.ipId}`);

    // On Sui the vault is intrinsic (each ArtifactRegistry holds its own revenue
    // balance). Commercial tiers + derivatives are the royalty-testable ones.
    const hasVault = e.tier === "gated" || e.tier === "compute" || e.tier === "derivative";
    console.log(`  vault ${hasVault ? "intrinsic (artifact's own revenue balance)" : "n/a for this tier"}\n`);

    await selfIndex(art as unknown as Record<string, unknown>);
    done[e.key] = {
      key: e.key,
      kind: e.kind,
      tier: art.tier ?? e.tier,
      ipId: art.ipId,
      capId: art.capId,
      parent: e.parent,
      hasVault,
    };
  }

  // --- report ---------------------------------------------------------------
  const rows = Object.values(done);
  console.log("=== royalty-readiness ===");
  console.log("key            kind     tier        vault?  artifactId");
  for (const r of rows) {
    console.log(
      `${r.key.padEnd(14)} ${r.kind.padEnd(8)} ${r.tier.padEnd(11)} ${(r.hasVault ? "YES" : "no").padEnd(6)}  ${r.ipId}`,
    );
  }
  const receivable = rows.filter((r) => r.hasVault);
  const derivatives = rows.filter((r) => r.parent);
  console.log(
    `\n${rows.length}/${manifest.length} registered · ${receivable.length} royalty-receivable · ${derivatives.length} derivatives (royalties flow to parent)`,
  );
  console.log("\nTo test paying royalties, use any artifactId marked vault=YES.");
  console.log("To test claiming, claim on a derivative's parent with its capId.");

  writeFileSync(resolve(SEED_DIR, "seed-results.json"), JSON.stringify(rows, null, 2));
  console.log(`\nwrote ${resolve(SEED_DIR, "seed-results.json")}`);
}

main().catch((e) => {
  console.error("SEED FAILED:", (e as Error)?.message ?? e);
  process.exit(1);
});
