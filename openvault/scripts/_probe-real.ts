// Real-connectivity probe — no gas required.
// Proves: Pinata pinning (JWT), CDR live reads (global pubkey + fees), wallet balance.
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

import { pinJSON } from "../lib/storage";
import { makeClientsFromKey } from "../lib/clients";
import { RPC_URL, CDR_API_URL } from "../lib/constants";

async function main() {
  console.log("IS_MOCK env NEXT_PUBLIC_MOCK =", process.env.NEXT_PUBLIC_MOCK);
  console.log("PINATA_JWT present:", !!process.env.PINATA_JWT, "PK present:", !!process.env.WALLET_PRIVATE_KEY);

  // 1) Pinata pin (real, JWT only)
  try {
    const pinned = await pinJSON({ probe: "openvault", t: "real-connectivity" });
    console.log("✓ PINATA pinJSON ->", pinned.uri);
  } catch (e) {
    console.log("✗ PINATA pinJSON failed:", (e as Error).message);
  }

  // 2) CDR live reads (no gas)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { cdr, account, publicClient } = (await makeClientsFromKey(
      process.env.WALLET_PRIVATE_KEY as `0x${string}`
    )) as any;
    console.log("wallet:", account.address);
    const gpk = await cdr.observer.getGlobalPubKey();
    console.log("✓ CDR getGlobalPubKey ->", gpk?.length, "bytes");
    try {
      const [alloc, write, read] = await Promise.all([
        cdr.observer.getAllocateFee(),
        cdr.observer.getWriteFee(),
        cdr.observer.getReadFee(),
      ]);
      console.log("✓ CDR fees (wei): allocate=%s write=%s read=%s", alloc, write, read);
    } catch (e) {
      console.log("• CDR fees read failed:", (e as Error).message);
    }
    // 3) wallet balance (gas check)
    const bal = await publicClient.getBalance({ address: account.address });
    console.log("wallet balance (wei):", bal, bal === 0n ? "→ UNFUNDED (fund via faucet to send txs)" : "→ funded");
  } catch (e) {
    console.log("✗ CDR/client init failed:", (e as Error).message);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
