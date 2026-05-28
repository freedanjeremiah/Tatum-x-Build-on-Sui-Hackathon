"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";

const WalletButtonPrivy = dynamic(() => import("./WalletButtonPrivy"), {
  ssr: false,
});

/**
 * Header wallet control. When PRIVY_APP_ID is not configured we render a
 * clearly inert pill. Otherwise we defer to the Privy-backed button.
 */
export default function WalletButton() {
  if (!PRIVY_APP_ID) {
    return (
      <span
        title="Wallet requires PRIVY_APP_ID to be configured"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-dashed border-[var(--ov-line)] px-3.5 py-1.5 text-xs text-[var(--ov-text-faint)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-text-faint)]" />
        Connect (unavailable)
      </span>
    );
  }
  return <WalletButtonPrivy />;
}
