"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";

// usePrivy() is only safe inside PrivyProvider, which Providers.tsx mounts only
// when PRIVY_APP_ID is set. Mirror the ProfileMenu gate: when Privy is absent
// render an honest connect prompt instead of calling the hook (which would
// throw). When present, load the Privy-consuming view client-only.
const TokensView = dynamic(() => import("./TokensView"), { ssr: false });

export default function TokensClient() {
  if (!PRIVY_APP_ID) {
    return (
      <div
        className="container maxw-upload"
        style={{ paddingTop: 36, paddingBottom: 64 }}
      >
        <div className="panel" style={{ padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ov-text-dim)", fontSize: 14 }}>
            Connect your wallet to see your license tokens.
          </p>
          <p
            className="meta"
            style={{ marginTop: 10, color: "var(--ov-text-faint)" }}
          >
            Wallet connect is unavailable — PRIVY_APP_ID is not configured.
          </p>
        </div>
      </div>
    );
  }
  return <TokensView />;
}
