"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";
import Icon from "./ui/Icon";

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
        className="btn btn-ghost btn-sm"
        style={{
          cursor: "not-allowed",
          borderStyle: "dashed",
          color: "var(--ov-text-faint)",
        }}
      >
        <Icon name="key" size={13} />
        Connect (unavailable)
      </span>
    );
  }
  return <WalletButtonPrivy />;
}
