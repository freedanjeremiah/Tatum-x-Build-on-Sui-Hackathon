"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Wallet-gated nav links (My Tokens / Profile). Reads the connected address
 * from the same source WalletButton uses — Privy's usePrivy(). Only mounted
 * inside PrivyProvider (via WalletNavLinks), so usePrivy() is always safe here.
 * Renders nothing until an address is present, so the rest of the nav never
 * blocks on wallet state.
 */
export default function WalletNavLinksPrivy() {
  const pathname = usePathname();
  const { user } = usePrivy();
  const address = user?.wallet?.address;
  if (!address) return null;

  return (
    <>
      <Link
        href="/tokens"
        className={`nav-link${pathname.startsWith("/tokens") ? " active" : ""}`}
      >
        My Tokens
      </Link>
      <Link
        href={`/profile/${address}`}
        className={`nav-link${pathname.startsWith("/profile") ? " active" : ""}`}
      >
        Profile
      </Link>
    </>
  );
}
