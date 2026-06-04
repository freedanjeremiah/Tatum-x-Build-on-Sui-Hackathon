// Real-connectivity probe (Sui-native) — no gas required.
// Proves: the Walrus storage helper is reachable (public metadata path), Sui RPC
// liveness via the Tatum gateway (chain identifier + reference gas price), and the
// signer's SUI balance (funded check) via client.core.getBalance.
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

import { pinJSON } from "../lib/storage";
import { makeClientsFromKey } from "../lib/clients";
import { TATUM_SUI_JSONRPC, REEF_PACKAGE_ID } from "../lib/constants";

async function main() {
  const pk = process.env.WALLET_PRIVATE_KEY ?? process.env.MASTER_SUI_PRIVKEY;
  console.log(
    "SUI key present:",
    !!pk,
    "TATUM gateway:",
    TATUM_SUI_JSONRPC,
  );

  // 1) Walrus storage helper (public metadata path).
  try {
    const pinned = await pinJSON({ probe: "reef", t: "real-connectivity" });
    console.log("✓ WALRUS pinJSON ->", pinned.uri);
  } catch (e) {
    console.log("✗ WALRUS pinJSON failed:", (e as Error).message);
  }

  if (!pk) {
    console.log("• No SUI key set — skipping on-chain probe (set WALLET_PRIVATE_KEY/MASTER_SUI_PRIVKEY).");
    return;
  }

  // 2) Sui RPC liveness (no gas) + signer balance.
  try {
    const { client, address } = await makeClientsFromKey(pk);
    console.log("wallet:", address);

    const gasPrice = await client.getReferenceGasPrice();
    console.log("✓ SUI getReferenceGasPrice ->", gasPrice.toString(), "MIST");

    const bal = await client.core.getBalance({ owner: address, coinType: "0x2::sui::SUI" });
    const mist = BigInt(bal.balance?.balance ?? "0");
    console.log(
      "wallet balance (MIST):",
      mist.toString(),
      mist === 0n ? "→ UNFUNDED (use the Sui testnet faucet to send txs)" : "→ funded",
    );

    if (REEF_PACKAGE_ID && REEF_PACKAGE_ID.trim() !== "") {
      const pkg = await client.core.getObject({ objectId: REEF_PACKAGE_ID });
      console.log("✓ reef package reachable:", Boolean((pkg as { object?: unknown }).object));
    } else {
      console.log("• REEF_PACKAGE_ID unset — registry calls will fail until it is set.");
    }
  } catch (e) {
    console.log("✗ Sui client/probe failed:", (e as Error).message);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
