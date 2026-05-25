// SPEC §8.4 — Gated download + negative-access proof.
//
// A reader who holds a valid license token can decrypt the vault artifact; a
// reader with no token is reverted by the on-chain read condition.
//
// Run (after 01): NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/02-download-gated.ts

import { encodeAbiParameters, parseEther } from "viem";

import { getClients, logTx, readLast } from "./_util";
import { IS_MOCK } from "../lib/env";
import { ROYALTY_MODULE } from "../lib/constants";

async function makeStorageProvider() {
  // VERIFY: real mode = HeliaProvider (helia + @helia/unixfs); mock = stub.
  return { CID: (s: string) => s } as any;
}

async function main() {
  const { cdr, story } = await getClients();
  const last = readLast();
  const ipId = last.ipId as `0x${string}`;
  const uuid = last.uuid;
  const licenseTermsId = last.licenseTermsId as string;

  const storageProvider = await makeStorageProvider();

  // (1) Acquire a license token: pay the minting fee in WIP, then mint.
  await story.wipClient.deposit({ amount: parseEther("1") } as any);
  const approveTx = await story.wipClient.approve({
    spender: ROYALTY_MODULE,
    amount: parseEther("1"),
  } as any);
  const mint = await story.license.mintLicenseTokens({
    licensorIpId: ipId,
    licenseTermsId: BigInt(licenseTermsId),
    amount: 1,
  } as any);
  const licenseTokenId = (mint as any).licenseTokenIds[0] as bigint;
  logTx("approve WIP", (approveTx as any).txHash);
  logTx("mint license", (mint as any).txHash);

  // (2) Build accessAuxData.
  // Real: ABI-encoded uint256[] of token ids. Mock vault keys its gate on the
  // token minted via __mintFor(ipId), so we hand it that raw token there.
  let accessAuxData: string;
  if (IS_MOCK) {
    accessAuxData = await (cdr as any).__mintFor(ipId);
  } else {
    accessAuxData = encodeAbiParameters(
      [{ type: "uint256[]" }],
      [[licenseTokenId]]
    );
  }

  // (3) Download + decrypt (CDR delivers the key; we decrypt locally).
  // VERIFY: real mode catches PartialCollectionTimeoutError from @piplabs/cdr-sdk.
  let text = "";
  try {
    const out = await cdr.consumer.downloadFile({
      uuid,
      accessAuxData,
      storageProvider,
      timeoutMs: 120000,
    } as any);
    text = new TextDecoder().decode((out as any).content);
  } catch (e) {
    console.error("download failed:", (e as Error).message);
    throw e;
  }

  console.log("=== 02-download-gated (SPEC §8.4) ===");
  console.log("licenseTokenId:", licenseTokenId.toString());
  console.log("decrypted bytes:", JSON.stringify(text));

  // (4) NEGATIVE check — no token must revert.
  let reverted = false;
  try {
    await cdr.consumer.downloadFile({
      uuid,
      accessAuxData: "0x",
      storageProvider,
      timeoutMs: 120000,
    } as any);
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
