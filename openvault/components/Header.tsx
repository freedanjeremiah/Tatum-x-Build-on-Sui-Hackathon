"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import VaultMark from "./ui/VaultMark";
import WalletButton from "./WalletButton";
import ProfileMenu from "./ProfileMenu";

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
            Open<span style={{ color: "var(--ov-accent)" }}>Vault</span>
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
        <span
          className="meta ov-network"
          style={{ color: "var(--ov-text-faint)" }}
        >
          Aeneid testnet
        </span>
        <ProfileMenu />
        <WalletButton />
      </div>
    </header>
  );
}
