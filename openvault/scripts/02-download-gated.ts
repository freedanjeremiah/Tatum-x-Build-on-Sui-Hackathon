// SPEC §8.4 — Gated download + negative-access proof.
//
// A reader who holds a valid license token can decrypt the vault artifact; a
// reader with no token is reverted by the on-chain read condition. The proven
// logic now lives in lib/artifacts.download.
//
// Run (after 01): NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/02-download-gated.ts

import { getClients, readLast } from "./_util";
import { download } from "../lib/artifacts";

async function main() {
  const clients = await getClients();
  const last = readLast();
  const ipId = last.ipId as `0x${string}`;
  const uuid = last.uuid as number;
  const licenseTermsId = last.licenseTermsId as string;

  // (1) Download with a freshly minted license token.
  const bytes = await download(clients as any, { ipId, uuid, licenseTermsId });
  const text = new TextDecoder().decode(bytes);

  console.log("=== 02-download-gated (SPEC §8.4) ===");
  console.log("decrypted bytes:", JSON.stringify(text));

  // (2) NEGATIVE check — no license/token must revert.
  let reverted = false;
  try {
    await download(clients as any, { ipId, uuid, licenseTermsId: "", mint: false });
  } catch {
    reverted = true;
  }
  if (!reverted) throw new Error("expected gated read to revert without a license");
  console.log("✓ gated read reverts without license");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
