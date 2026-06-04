"use client";

import { ConnectButton } from "@mysten/dapp-kit";

/**
 * Sui wallet connect control (signing wallet). dapp-kit's <ConnectButton>
 * surfaces every installed Sui wallet-standard wallet and manages connect /
 * account / disconnect. The connected account drives <WalletBridge>, which is
 * what makes getClients() return a working browser signer (transact + decrypt).
 *
 * This is separate from the Privy button (auth/login): Privy v3.28 has no Sui
 * support, so on-chain writes + Seal decryption require a connected Sui wallet
 * here. Loaded client-only via the header.
 */
export default function SuiWalletButton() {
  return <ConnectButton connectText="Connect Sui wallet" />;
}
