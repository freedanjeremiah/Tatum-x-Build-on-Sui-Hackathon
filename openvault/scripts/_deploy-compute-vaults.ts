// Deploy royalty vaults for the compute-tier seed IPs. uploadCompute returns the
// terms id as `computeLicenseTermsId` (not `licenseTermsId`), so the seed's mint
// step skipped them. Mint one self-license each (using computeLicenseTermsId) to
// deploy the vault. No re-registration.
//
// Run: pnpm real scripts/_deploy-compute-vaults.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEther, zeroAddress } from "viem";
import { getClients } from "./_util";
import { mintLicense } from "../lib/licensing";
import { fetchRoyaltyVault } from "../lib/royalty";

const SEED_DIR = resolve(__dirname, "sample", "seed");
const INDEX = process.env.OPENVAULT_INDEX_URL ?? "http://localhost:3000/api/index";

async function main() {
  const clients = await getClients();
  const pc = (clients as any).publicClient;

  const manifest = JSON.parse(readFileSync(resolve(SEED_DIR, "seed-manifest.json"), "utf-8")) as any[];
  const results = JSON.parse(readFileSync(resolve(SEED_DIR, "seed-results.json"), "utf-8")) as any[];
  const idByKey: Record<string, `0x${string}`> = {};
  for (const r of results) idByKey[r.key] = r.ipId;

  // computeLicenseTermsId lives in the index (selfIndex persisted it).
  const all = (await (await fetch(INDEX)).json()) as any[];
  const termsByIp: Record<string, string> = {};
  for (const a of all) termsByIp[a.ipId.toLowerCase()] = a.computeLicenseTermsId;

  const computeEntries = manifest.filter((e) => e.tier === "compute");
  console.log(`deploying vaults for ${computeEntries.length} compute IPs\n`);

  for (const e of computeEntries) {
    const ipId = idByKey[e.key];
    if (!ipId) {
      console.warn(`${e.key}: no ipId in results — skip`);
      continue;
    }
    const termsId = termsByIp[ipId.toLowerCase()];
    const fee = parseEther(e.terms.fee);
    console.log(`→ ${e.key} ${ipId} termsId=${termsId} fee=${e.terms.fee}`);
    try {
      const tokenId = await mintLicense(clients.story, ipId, termsId, fee);
      const vault = await fetchRoyaltyVault(pc, ipId);
      console.log(
        `  minted #${tokenId} → vault ${vault !== zeroAddress ? vault : "STILL NONE"}\n`,
      );
    } catch (err: any) {
      console.error(`  ✗ ${err?.shortMessage || err?.message || err}\n`);
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.shortMessage || e?.message || e);
  process.exit(1);
});
