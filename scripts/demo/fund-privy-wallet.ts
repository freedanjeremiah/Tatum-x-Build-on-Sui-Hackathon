// Fund a Privy embedded wallet on Aeneid testnet from the server signer
// (WALLET_PRIVATE_KEY in .env.local). USE-ONLY-FOR-TESTNET demo flow.
//
// Run:
//   cd openvault
//   pnpm real scripts/demo/fund-privy-wallet.ts <0xPrivyAddress> [amountIp]
//
// Defaults to 2 IP if amount is omitted.
//
// Sanity: refuses to send if `to` is not a 0x40-hex address or if the signer
// would be left below 1 IP after the transfer.

import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aeneid } from "../../lib/chains";
import { RPC_URL } from "../../lib/constants";

async function main() {
  const [, , rawTo, rawAmt] = process.argv;
  if (!rawTo || !/^0x[0-9a-fA-F]{40}$/.test(rawTo)) {
    console.error(
      "usage: pnpm real scripts/demo/fund-privy-wallet.ts <0xPrivyAddress> [amountIp]",
    );
    process.exit(1);
  }
  const to = rawTo as `0x${string}`;
  const amountIp = rawAmt ?? "2";
  const value = parseEther(amountIp);

  const pk = process.env.WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) {
    console.error("WALLET_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  const account = privateKeyToAccount(pk);
  const pub = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });
  const wal = createWalletClient({ account, chain: aeneid, transport: http(RPC_URL) });

  const senderBal = await pub.getBalance({ address: account.address });
  console.log(`Signer ${account.address} balance: ${formatEther(senderBal)} IP`);
  console.log(`Target ${to}`);
  console.log(`Amount ${amountIp} IP`);

  const reserve = parseEther("1"); // keep at least 1 IP for gas + future demo ops
  if (senderBal < value + reserve) {
    console.error(
      `Refusing: signer balance ${formatEther(senderBal)} IP < amount ${amountIp} + 1 IP reserve.`,
    );
    process.exit(2);
  }

  console.log("Sending…");
  const hash = await wal.sendTransaction({ to, value });
  console.log("Tx hash:", hash);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);

  const newBal = await pub.getBalance({ address: to });
  console.log(`Target ${to} new balance: ${formatEther(newBal)} IP`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
