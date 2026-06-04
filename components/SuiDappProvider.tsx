"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { suiNetwork } from "@/lib/chains";
import WalletBridge from "./WalletBridge";

// dapp-kit styles power its <ConnectModal>/<ConnectButton>. We render those for
// the Sui wallet-connect flow, so the stylesheet is required.
import "@mysten/dapp-kit/dist/index.css";

// Network config for dapp-kit's read client. We reuse Reef's resolved RPC URL
// (Tatum gateway when a key is set, else the public fullnode) so dapp-kit reads
// hit the same endpoint as the rest of the app. The browser write/decrypt
// signer comes from the connected wallet, not from this client.
const { networkConfig } = createNetworkConfig({
  reef: {
    url: suiNetwork.rpcUrl || suiNetwork.fullnodeUrl,
    network: suiNetwork.network,
  },
});

/**
 * Sui signing context for the browser.
 *
 * DECISION: Privy v3.28 has no Sui support, so Sui SIGNING is provided by
 * @mysten/dapp-kit (the Sui wallet-standard) while Privy keeps AUTH (email/
 * social login). This provider supplies the dapp-kit React context that
 * <WalletBridge> and the Sui connect button depend on. It wraps the whole app
 * and is independent of whether Privy is configured.
 */
export default function SuiDappProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // One QueryClient per mount (avoids sharing across React fast-refresh reloads).
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="reef">
        <WalletProvider autoConnect>
          <WalletBridge />
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
