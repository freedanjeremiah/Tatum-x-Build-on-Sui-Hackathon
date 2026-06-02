// Seed the vault with 10 valid datasets + 10 valid models spanning every tier,
// uploading each through the real lib/artifacts path. Commercial tiers
// (gated / compute) get a self license-mint so their royalty vault is deployed
// and they are immediately royalty-testable; derivatives flow royalties to their
// parent. Prints a royalty-readiness table and writes seed-results.json.
//
// Prereq: generate the files first —  python scripts/sample/make_seed_artifacts.py
// Run:    pnpm real scripts/_seed-royalty.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEther, zeroAddress } from "viem";
import { getClients, logTx, selfIndex } from "./_util";
import {
  uploadPublic,
  uploadPrivate,
  uploadGated,
  uploadCompute,
  registerDerivative,
  type Clients,
} from "../lib/artifacts";
import { mintLicense } from "../lib/licensing";
import { fetchRoyaltyVault } from "../lib/royalty";

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

async function main() {
  const clients = (await getClients()) as unknown as Clients;
  const owner = clients.account.address;
  const pc = (clients as any).publicClient;

  const manifest = JSON.parse(
    readFileSync(resolve(SEED_DIR, "seed-manifest.json"), "utf-8"),
  ) as Entry[];

  console.log(`=== seeding ${manifest.length} artifacts as ${owner} ===\n`);

  const done: Record<
    string,
    {
      key: string;
      kind: string;
      tier: string;
      ipId: `0x${string}`;
      licenseTermsId?: string;
      parent: string | null;
      vault: `0x${string}`;
      hasVault: boolean;
    }
  > = {};

  for (const e of manifest) {
    const bytes = new Uint8Array(readFileSync(resolve(SEED_DIR, e.file)));
    const meta = {
      title: e.title,
      description: e.description,
      tags: e.tags,
      creators: [{ name: "OpenVault Demo", address: owner, contributionPercent: 100 }],
      modality: e.kind,
    };

    console.log(`→ ${e.key} (${e.tier}, ${bytes.length}B) ${e.title}`);
    let art: any;
    try {
      if (e.tier === "public") {
        art = await uploadPublic(clients, { bytes, meta });
      } else if (e.tier === "private") {
        art = await uploadPrivate(clients, { bytes, meta });
      } else if (e.tier === "gated") {
        art = await uploadGated(clients, {
          bytes,
          meta,
          terms: { rev: e.terms!.rev, fee: parseEther(e.terms!.fee) },
        });
      } else if (e.tier === "compute") {
        art = await uploadCompute(clients, {
          bytes,
          meta,
          terms: { rev: e.terms!.rev, fee: parseEther(e.terms!.fee) },
          allowedAlgoHashes: [],
        });
      } else if (e.tier === "derivative") {
        const parent = e.parent ? done[e.parent] : undefined;
        if (!parent || !parent.licenseTermsId) {
          throw new Error(`derivative parent ${e.parent} not registered with license terms`);
        }
        art = await registerDerivative(clients, {
          parentIpId: parent.ipId,
          parentTermsId: parent.licenseTermsId,
          bytes,
          meta,
        });
      }
    } catch (err: any) {
      console.error(`  ✗ register failed: ${err?.shortMessage || err?.message || err}\n`);
      continue;
    }

    logTx("  registered", art.createdTx);
    console.log(`  ipId ${art.ipId}`);

    // Commercial tiers: deploy the royalty vault via a self license-mint so the
    // IP can immediately receive royalties. fee=0 → cap 0.
    if ((e.tier === "gated" || e.tier === "compute") && art.licenseTermsId) {
      try {
        const cap = parseEther(e.terms!.fee);
        const tokenId = await mintLicense(clients.story, art.ipId, art.licenseTermsId, cap);
        console.log(`  minted license #${tokenId} (vault deploy)`);
      } catch (err: any) {
        console.warn(`  ⚠ license mint failed (vault may not deploy): ${err?.shortMessage || err?.message || err}`);
      }
    }

    let vault: `0x${string}` = zeroAddress;
    try {
      vault = await fetchRoyaltyVault(pc, art.ipId);
    } catch {
      /* read hiccup — leave zero */
    }
    const hasVault = vault !== zeroAddress;
    console.log(`  vault ${hasVault ? vault : "none"}\n`);

    await selfIndex(art as Record<string, unknown>);
    done[e.key] = {
      key: e.key,
      kind: e.kind,
      tier: art.tier ?? e.tier,
      ipId: art.ipId,
      licenseTermsId: art.licenseTermsId,
      parent: e.parent,
      vault,
      hasVault,
    };
  }

  // --- report ---------------------------------------------------------------
  const rows = Object.values(done);
  console.log("=== royalty-readiness ===");
  console.log("key            kind     tier        vault?  ipId");
  for (const r of rows) {
    console.log(
      `${r.key.padEnd(14)} ${r.kind.padEnd(8)} ${r.tier.padEnd(11)} ${(r.hasVault ? "YES" : "no").padEnd(6)}  ${r.ipId}`,
    );
  }
  const receivable = rows.filter((r) => r.hasVault);
  const derivatives = rows.filter((r) => r.parent);
  console.log(
    `\n${rows.length}/${manifest.length} registered · ${receivable.length} royalty-receivable (have vaults) · ${derivatives.length} derivatives (royalties flow to parent)`,
  );
  console.log("\nTo test paying royalties, use any ipId marked vault=YES.");
  console.log("To test claiming, claim on a derivative's parent.");

  writeFileSync(resolve(SEED_DIR, "seed-results.json"), JSON.stringify(rows, null, 2));
  console.log(`\nwrote ${resolve(SEED_DIR, "seed-results.json")}`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e?.shortMessage || e?.message || e);
  process.exit(1);
});
