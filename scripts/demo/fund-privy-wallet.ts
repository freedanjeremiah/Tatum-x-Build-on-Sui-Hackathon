// Fund a Privy embedded Sui wallet from the server signer
// (WALLET_PRIVATE_KEY / MASTER_SUI_PRIVKEY in .env.local). TESTNET-ONLY demo flow.
//
// Run:
//   pnpm real scripts/demo/fund-privy-wallet.ts <0xSuiAddress> [amountSui]
//
// Defaults to 2 SUI if amount is omitted.
//
// Sanity: refuses to send if `to` is not a 0x Sui address or if the signer would
// be left below a 1 SUI gas reserve after the transfer. Adapted from sharegraph
// packages/core/src/funding.ts (coinWithBalance + transferObjects).

import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { makeClientsFromKey } from "../../lib/clients";

const MIST_PER_SUI = 1_000_000_000n;

function suiToMist(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(9)).slice(0, 9);
  return BigInt(whole) * MIST_PER_SUI + BigInt(fracPadded || "0");
}

async function balanceMist(
  client: Awaited<ReturnType<typeof makeClientsFromKey>>["client"],
  owner: string,
): Promise<bigint> {
  const bal = await client.core.getBalance({ owner, coinType: "0x2::sui::SUI" });
  return BigInt(bal.balance?.balance ?? "0");
}

async function main() {
  const [, , rawTo, rawAmt] = process.argv;
  if (!rawTo || !/^0x[0-9a-fA-F]{1,64}$/.test(rawTo)) {
    console.error(
      "usage: pnpm real scripts/demo/fund-privy-wallet.ts <0xSuiAddress> [amountSui]",
    );
    process.exit(1);
  }
  const to = rawTo as `0x${string}`;
  const amountSui = rawAmt ?? "2";
  const value = suiToMist(amountSui);

  const pk = process.env.WALLET_PRIVATE_KEY ?? process.env.MASTER_SUI_PRIVKEY;
  if (!pk) {
    console.error("WALLET_PRIVATE_KEY (or MASTER_SUI_PRIVKEY) not set in .env.local");
    process.exit(1);
  }

  const { client, signer, address } = await makeClientsFromKey(pk);

  const senderBal = await balanceMist(client, address);
  console.log(`Signer ${address} balance: ${senderBal} MIST`);
  console.log(`Target ${to}`);
  console.log(`Amount ${amountSui} SUI (${value} MIST)`);

  const reserve = MIST_PER_SUI; // keep at least 1 SUI for gas + future demo ops
  if (senderBal < value + reserve) {
    console.error(
      `Refusing: signer balance ${senderBal} MIST < amount ${value} + 1 SUI reserve.`,
    );
    process.exit(2);
  }

  console.log("Sending…");
  const tx = new Transaction();
  tx.transferObjects([tx.add(coinWithBalance({ balance: value }))], to);
  const r = await client.core.signAndExecuteTransaction({
    transaction: tx,
    signer,
    include: { effects: true },
  });
  const digest = r.$kind === "Transaction" ? r.Transaction?.digest : undefined;
  if (!digest) throw new Error(`fund tx failed: ${JSON.stringify(r.$kind)}`);
  await client.core.waitForTransaction({ digest });
  console.log("Tx digest:", digest);

  const newBal = await balanceMist(client, to);
  console.log(`Target ${to} new balance: ${newBal} MIST`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
