"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "./WalletButton";

const NAV = [
  { href: "/", label: "Browse" },
  { href: "/upload", label: "Upload" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--ov-line)] bg-[var(--ov-bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <VaultMark />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--ov-text)]">
            Open<span className="text-[var(--ov-accent)]">Vault</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "text-[var(--ov-text)]"
                    : "text-[var(--ov-text-dim)] hover:text-[var(--ov-text)]"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-[var(--ov-accent)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-[var(--ov-text-faint)] md:inline">
            Aeneid testnet
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

/** Vault padlock mark with a subtle keyhole — the brand glyph. */
function VaultMark() {
  return (
    <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-[var(--ov-accent)]/30 bg-[var(--ov-accent)]/10 transition-colors group-hover:border-[var(--ov-accent)]/60">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ov-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="10" width="16" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15" r="1.4" />
        <path d="M12 16.4V18" />
      </svg>
    </span>
  );
}
