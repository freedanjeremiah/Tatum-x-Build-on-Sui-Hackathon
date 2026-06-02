"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import Icon, { type IconName } from "./ui/Icon";

/**
 * Avatar-icon account menu. Replaces the old flat wallet-gated nav links
 * (New Group / My Tokens / Profile) with a single dropdown next to the wallet
 * button. Reads the connected address from the same source WalletButton uses —
 * Privy's usePrivy(). Only mounted inside PrivyProvider (via ProfileMenu), so
 * usePrivy() is always safe here. Renders nothing until an address is present.
 */
export default function ProfileMenuPrivy() {
  const pathname = usePathname();
  const { user } = usePrivy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const address = user?.wallet?.address;
  if (!address) return null;

  const items: Array<{ href: string; label: string; icon: IconName }> = [
    { href: `/profile/${address}`, label: "Profile", icon: "vault" },
    { href: "/tokens", label: "My Tokens", icon: "key" },
    { href: "/group/new", label: "New Group", icon: "layers" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-label="Account menu"
        style={{ padding: "5px 9px", gap: 7 }}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar address={address} />
        <span style={{ display: "inline-flex", color: "var(--ov-text-faint)" }}>
          <Icon name="chevron" size={12} />
        </span>
      </button>
      {open ? (
        <div
          className="panel anim-up"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 200,
            padding: 8,
            zIndex: 60,
          }}
        >
          <div className="meta" style={{ padding: "2px 6px 8px" }}>
            Account
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {items.map((it) => {
              const active =
                it.href === "/tokens"
                  ? pathname.startsWith("/tokens")
                  : it.href === "/group/new"
                    ? pathname === "/group/new"
                    : pathname.startsWith("/profile");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    justifyContent: "flex-start",
                    borderColor: active ? "var(--ov-accent)" : undefined,
                    color: active ? "var(--ov-accent)" : undefined,
                  }}
                >
                  <Icon name={it.icon} size={13} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Deterministic gradient circle derived from the address — a lightweight
 *  identicon so the menu reads as "your account" without a new icon dep. */
function Avatar({ address }: { address: string }) {
  const h = hashHue(address);
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        flex: "none",
        background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 60) % 360} 70% 45%))`,
        boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--ov-text) 12%, transparent)",
      }}
    />
  );
}

function hashHue(s: string): number {
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    acc = (acc * 31 + s.charCodeAt(i)) % 360;
  }
  return acc;
}
