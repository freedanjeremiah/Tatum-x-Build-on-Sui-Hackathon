"use client";

import dynamic from "next/dynamic";
import { IS_MOCK, PRIVY_APP_ID } from "@/lib/env";

const WalletButtonPrivy = dynamic(() => import("./WalletButtonPrivy"), {
  ssr: false,
});

/**
 * Header wallet control. In mock mode there is no chain, so we render a clearly
 * inert pill. In real mode we defer to the Privy-backed button.
 */
export default function WalletButton() {
  if (IS_MOCK || !PRIVY_APP_ID) {
    return (
      <span
        title="Wallet is disabled in mock mode"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-dashed border-[var(--ov-line)] px-3.5 py-1.5 text-xs text-[var(--ov-text-faint)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-text-faint)]" />
        Connect (mock)
      </span>
    );
  }
  return <WalletButtonPrivy />;
}
