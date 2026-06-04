"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import VaultMark from "./ui/VaultMark";
import WalletButton from "./WalletButton";
import ProfileMenu from "./ProfileMenu";
import TatumStatus from "./TatumStatus";

// Sui signing wallet (dapp-kit). Client-only: it discovers browser wallets via
// window/localStorage. Separate from the Privy auth button (WalletButton).
const SuiWalletButton = dynamic(() => import("./SuiWalletButton"), {
  ssr: false,
});

const NAV = [
  { href: "/", label: "Browse" },
  { href: "/search", label: "Search" },
  { href: "/upload", label: "Upload" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="ov-header">
      <div
        className="container maxw-browse"
        style={{ display: "flex", alignItems: "center", gap: 22, height: 62 }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <VaultMark size={30} />
          <span
            className="font-display"
            style={{
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: "var(--ov-text)",
            }}
          >
            Re<span style={{ color: "var(--ov-accent)" }}>ef</span>
          </span>
        </Link>

        <nav
          className="ov-nav"
          style={{ display: "flex", gap: 20, marginLeft: 8 }}
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/" ||
                  pathname.startsWith("/artifact") ||
                  pathname.startsWith("/group") ||
                  pathname.startsWith("/compute")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />
        <TatumStatus />
        <ProfileMenu />
        <SuiWalletButton />
        <WalletButton />
      </div>
    </header>
  );
}
